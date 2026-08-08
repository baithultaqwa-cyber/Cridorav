"""KYC wizard progress + profile persistence."""
from __future__ import annotations

from django.utils import timezone

from .models import KYCDocument, KycProfile, User


WIZARD_DOC_TYPES = [
    KYCDocument.EMIRATES_ID_FRONT,
    KYCDocument.EMIRATES_ID_BACK,
    KYCDocument.PASSPORT_FRONT,
    KYCDocument.PASSPORT_BACK,
]

STEP1_FIELDS = (
    'full_name',
    'date_of_birth',
    'place_of_birth',
    'nationality',
    'residency_status',
    'emirates_id_number',
    'passport_number',
)


def get_or_create_profile(user) -> KycProfile:
    profile, _ = KycProfile.objects.get_or_create(user=user)
    return profile


def _step1_complete(profile: KycProfile | None) -> bool:
    if not profile:
        return False
    if not (profile.full_name or '').strip():
        return False
    if not profile.date_of_birth:
        return False
    if not (profile.place_of_birth or '').strip():
        return False
    if not (profile.nationality or '').strip():
        return False
    if not (profile.residency_status or '').strip():
        return False
    if not (profile.emirates_id_number or '').strip() and not (profile.passport_number or '').strip():
        return False
    return True


def _has_file(doc) -> bool:
    return bool(doc and getattr(doc, 'file', None))


def _step2_complete(user) -> bool:
    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    if all(_has_file(uploaded.get(dt)) for dt in WIZARD_DOC_TYPES):
        return True
    legacy_eid = _has_file(uploaded.get(KYCDocument.EMIRATES_ID))
    legacy_pp = _has_file(uploaded.get(KYCDocument.PASSPORT)) or _has_file(uploaded.get(KYCDocument.PASSPORT_VISA))
    return bool(legacy_eid and legacy_pp)


def _step3_complete(user, profile: KycProfile | None) -> bool:
    if user.kyc_submitted_at:
        return True
    return bool(profile and profile.submitted_at)


def kyc_progress_dict(user) -> dict:
    try:
        profile = user.kyc_profile
    except KycProfile.DoesNotExist:
        profile = None
    s1 = _step1_complete(profile)
    s2 = _step2_complete(user)
    s3 = _step3_complete(user, profile)
    completed = int(s1) + int(s2) + int(s3)
    if not s1:
        current = 1
    elif not s2:
        current = 2
    else:
        current = 3
    from .compliance import customer_compliance_verification
    comp = customer_compliance_verification(user)
    return {
        'current_step': current,
        'completed_steps': completed,
        'total_steps': 3,
        'percent': round(completed * 100 / 3),
        'step1_complete': s1,
        'step2_complete': s2,
        'step3_complete': s3,
        'submitted': s3,
        'status': user.kyc_status,
        'trading_allowed': comp.get('trading_allowed'),
        'pending_items': comp.get('pending_items') or [],
        'rejection_reason': comp.get('rejection_reason', ''),
        'aml_result': (profile.aml_result if profile else None) or None,
    }


def profile_to_dict(profile: KycProfile | None) -> dict:
    if not profile:
        return {
            'full_name': '',
            'date_of_birth': None,
            'place_of_birth': '',
            'nationality': '',
            'residency_status': '',
            'emirates_id_number': '',
            'passport_number': '',
        }
    return {
        'full_name': profile.full_name,
        'date_of_birth': str(profile.date_of_birth) if profile.date_of_birth else None,
        'place_of_birth': profile.place_of_birth,
        'nationality': profile.nationality,
        'residency_status': profile.residency_status,
        'emirates_id_number': profile.emirates_id_number,
        'passport_number': profile.passport_number,
    }


def update_profile_from_data(user, data: dict) -> KycProfile:
    profile = get_or_create_profile(user)
    if 'full_name' in data:
        profile.full_name = str(data.get('full_name') or '').strip()[:200]
        parts = profile.full_name.split(None, 1)
        if parts:
            user.first_name = parts[0][:150]
            user.last_name = (parts[1] if len(parts) > 1 else '')[:150]
            user.save(update_fields=['first_name', 'last_name'])
    if 'date_of_birth' in data:
        from django.utils.dateparse import parse_date
        raw = str(data.get('date_of_birth') or '').strip()
        profile.date_of_birth = parse_date(raw) if raw else None
    if 'place_of_birth' in data:
        profile.place_of_birth = str(data.get('place_of_birth') or '').strip()[:120]
    if 'nationality' in data:
        profile.nationality = str(data.get('nationality') or '').strip()[:100]
    if 'residency_status' in data:
        rs = str(data.get('residency_status') or '').strip().lower()
        if rs in ('resident', 'visitor', ''):
            profile.residency_status = rs
            if rs == 'resident':
                user.residency_has_emirates_id = True
                user.save(update_fields=['residency_has_emirates_id'])
            elif rs == 'visitor':
                user.residency_has_emirates_id = False
                user.save(update_fields=['residency_has_emirates_id'])
    if 'emirates_id_number' in data:
        profile.emirates_id_number = str(data.get('emirates_id_number') or '').strip()[:32]
    if 'passport_number' in data:
        profile.passport_number = str(data.get('passport_number') or '').strip()[:32]
    if 'country' in data:
        user.country = str(data.get('country') or '').strip()[:100]
        user.save(update_fields=['country'])
    if _step1_complete(profile) and not profile.step1_completed_at:
        profile.step1_completed_at = timezone.now()
    profile.save()
    return profile


def submit_kyc(user) -> tuple[bool, str, KycProfile | None]:
    profile = get_or_create_profile(user)
    if not _step1_complete(profile):
        return False, 'Please complete your identity details first.', profile
    if not _step2_complete(user):
        return False, 'Please upload Emirates ID (front & back) and passport (front & back).', profile
    now = timezone.now()
    profile.submitted_at = now
    profile.step2_completed_at = profile.step2_completed_at or now
    user.kyc_submitted_at = now
    if user.kyc_status == User.KYC_REJECTED:
        user.kyc_status = User.KYC_PENDING
        user.kyc_rejection_reason = ''
        user.save(update_fields=['kyc_submitted_at', 'kyc_status', 'kyc_rejection_reason'])
    else:
        if user.kyc_status != User.KYC_VERIFIED:
            user.kyc_status = User.KYC_PENDING
            user.save(update_fields=['kyc_submitted_at', 'kyc_status'])
        else:
            user.save(update_fields=['kyc_submitted_at'])

    docs = list(KYCDocument.objects.filter(user=user))
    try:
        from compliance_ai.aml import run_aml_assist
        profile.aml_result = run_aml_assist(user, profile, docs)
        profile.aml_checked_at = now
    except Exception:
        profile.aml_result = {
            'risk': 'unknown',
            'summary': 'AML assist could not run. Admin must review manually.',
            'flags': [],
            'vision_used': False,
            'checked_at': now.isoformat(),
        }
        profile.aml_checked_at = now
    profile.save()
    return True, 'Submitted for review. We will notify you once verified.', profile
