"""
Server-side AML assist: rule checks + optional Google Cloud Vision OCR.
Never auto-approves or auto-rejects. Results are stored for admin review only.
"""
from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from difflib import SequenceMatcher

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# FATF / UAE CBUAE-style high-risk and prohibited jurisdictions (ISO-ish names).
HIGH_RISK_COUNTRIES = {
    'iran', 'islamic republic of iran',
    'north korea', 'dprk', "democratic people's republic of korea",
    'syria', 'syrian arab republic',
    'myanmar', 'burma',
    'yemen',
    'afghanistan',
    'south sudan',
    'sudan',
}
BANNED_ACTIVITY_HINTS = (
    'sanction', 'embargo', 'money laundering', 'terrorist', 'proliferation',
)

VISION_ANNOTATE_URL = 'https://vision.googleapis.com/v1/images:annotate'


def _norm_country(value: str) -> str:
    return re.sub(r'\s+', ' ', (value or '').strip().lower())


def _fuzzy_ratio(a: str, b: str) -> float:
    a = re.sub(r'\s+', ' ', (a or '').strip().lower())
    b = re.sub(r'\s+', ' ', (b or '').strip().lower())
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def vision_configured() -> bool:
    return bool((getattr(settings, 'GOOGLE_VISION_API_KEY', '') or '').strip())


def _ocr_image_bytes(data: bytes) -> str:
    api_key = (getattr(settings, 'GOOGLE_VISION_API_KEY', '') or '').strip()
    if not api_key or not data:
        return ''
    import base64
    b64 = base64.b64encode(data).decode('ascii')
    payload = json.dumps({
        'requests': [{
            'image': {'content': b64},
            'features': [{'type': 'TEXT_DETECTION', 'maxResults': 1}],
        }],
    }).encode('utf-8')
    url = f'{VISION_ANNOTATE_URL}?key={api_key}'
    req = urllib.request.Request(
        url,
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = json.loads(resp.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, json.JSONDecodeError):
        logger.warning('Google Vision OCR request failed')
        return ''
    try:
        annotations = body['responses'][0].get('textAnnotations') or []
        if not annotations:
            return ''
        return annotations[0].get('description') or ''
    except (KeyError, IndexError, TypeError):
        return ''


def _read_doc_bytes(doc) -> bytes:
    if not doc or not getattr(doc, 'file', None):
        return b''
    try:
        with doc.file.open('rb') as f:
            return f.read(4_000_000)
    except Exception:
        logger.warning('Could not read KYC file for AML OCR')
        return b''


def run_aml_assist(user, profile, documents) -> dict:
    """
    documents: iterable of KYCDocument.
    Returns a JSON-serialisable dict stored on KycProfile.aml_result.
    """
    flags = []
    nationality = _norm_country(getattr(profile, 'nationality', '') or '')
    residency = _norm_country(getattr(profile, 'residency_status', '') or '')
    country = _norm_country(getattr(user, 'country', '') or '')

    for label, value in (('nationality', nationality), ('country', country)):
        if value and any(value == risk or risk in value for risk in HIGH_RISK_COUNTRIES):
            flags.append({
                'code': 'high_risk_jurisdiction',
                'severity': 'high',
                'field': label,
                'detail': f'{label.title()} matches a high-risk / restricted jurisdiction list.',
            })

    full_name = (getattr(profile, 'full_name', '') or '').strip()
    eid = (getattr(profile, 'emirates_id_number', '') or '').strip()
    passport_no = (getattr(profile, 'passport_number', '') or '').strip()

    ocr_text_parts = []
    vision_used = False
    if vision_configured():
        for doc in documents:
            raw = _read_doc_bytes(doc)
            if not raw:
                continue
            text = _ocr_image_bytes(raw)
            if text:
                vision_used = True
                ocr_text_parts.append(text)
    ocr_blob = '\n'.join(ocr_text_parts)

    if ocr_blob:
        blob_l = ocr_blob.lower()
        if full_name and _fuzzy_ratio(full_name, ocr_blob[:400]) < 0.35 and full_name.lower() not in blob_l:
            flags.append({
                'code': 'name_mismatch',
                'severity': 'medium',
                'field': 'full_name',
                'detail': 'Name on the form was not clearly found in document OCR. Please compare manually.',
            })
        if eid and eid.replace('-', '') not in re.sub(r'\D', '', ocr_blob) and eid.lower() not in blob_l:
            flags.append({
                'code': 'eid_not_in_ocr',
                'severity': 'medium',
                'field': 'emirates_id_number',
                'detail': 'Emirates ID number was not detected in OCR text.',
            })
        if passport_no and passport_no.lower() not in blob_l.replace(' ', ''):
            flags.append({
                'code': 'passport_not_in_ocr',
                'severity': 'low',
                'field': 'passport_number',
                'detail': 'Passport number was not clearly detected in OCR text.',
            })
        for hint in BANNED_ACTIVITY_HINTS:
            if hint in blob_l:
                flags.append({
                    'code': 'document_keyword',
                    'severity': 'high',
                    'field': 'documents',
                    'detail': f'Document OCR contained a sensitive keyword ({hint}). Review carefully.',
                })
                break

    if residency == 'resident' and not eid:
        flags.append({
            'code': 'missing_eid_for_resident',
            'severity': 'medium',
            'field': 'emirates_id_number',
            'detail': 'Resident selected but Emirates ID number is empty.',
        })

    severities = {f['severity'] for f in flags}
    if 'high' in severities:
        risk = 'high'
    elif 'medium' in severities:
        risk = 'medium'
    elif flags:
        risk = 'low'
    else:
        risk = 'clear'

    summary = 'No automated AML flags. Admin still must review documents.'
    if flags:
        summary = f'{len(flags)} automated flag(s). Human decision required — do not auto-approve.'

    return {
        'risk': risk,
        'summary': summary,
        'flags': flags,
        'vision_used': vision_used,
        'checked_at': timezone.now().isoformat(),
        'inputs': {
            'full_name': full_name,
            'nationality': getattr(profile, 'nationality', '') or '',
            'residency_status': getattr(profile, 'residency_status', '') or '',
            'country': getattr(user, 'country', '') or '',
        },
    }
