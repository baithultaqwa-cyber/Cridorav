"""
Customer / vendor compliance (v7 light KYC + legacy full-KYC fallback).

Trading below INTERNAL_KYC_THRESHOLD: Emirates ID OR passport+visa (residency-based).
Crossing threshold requires verified income proof before payment can complete.
Bank details still required for sell-back payouts but not for first purchase below threshold.
"""
from decimal import Decimal

from django.utils import timezone

from .models import User, KYCDocument, CustomerBankDetails, PlatformConfig


def _month_key():
    return timezone.now().strftime('%Y-%m')


def ensure_monthly_bucket(user):
    mk = _month_key()
    if user.cumulative_purchase_month_key != mk:
        user.cumulative_purchase_month_key = mk
        user.cumulative_purchase_total_this_month = Decimal('0')
        user.save(update_fields=['cumulative_purchase_month_key', 'cumulative_purchase_total_this_month'])


def _doc_ok(doc):
    return (
        doc
        and doc.status == KYCDocument.DOC_VERIFIED
        and not doc.is_expired
    )


def _has_light_identity(user, uploaded):
    """v7 §9.2 — EID or passport+visa; also accept legacy verified passport as identity."""
    if _doc_ok(uploaded.get(KYCDocument.EMIRATES_ID)):
        return True
    if _doc_ok(uploaded.get(KYCDocument.PASSPORT_VISA)):
        return True
    # Legacy passport (+ optionally admin KYC verified) counts as identity for cutover
    if _doc_ok(uploaded.get(KYCDocument.PASSPORT)):
        return True
    if user.kyc_status == User.KYC_VERIFIED:
        return True
    return False


def customer_compliance_verification(user):
    pending_items = []

    if user.kyc_status == User.KYC_REJECTED:
        reason = (getattr(user, 'kyc_rejection_reason', '') or '').strip()
        detail = f'Your KYC application was rejected: {reason}' if reason else \
            'Your KYC application was rejected. Contact support to resubmit.'
        return {
            'status': 'rejected',
            'trading_allowed': False,
            'rejection_reason': reason,
            'pending_items': [{
                'section': 'identity',
                'label': 'KYC decision',
                'detail': detail,
            }],
            'kyc_mode': 'light',
            'income_proof_status': getattr(user, 'income_proof_status', 'none') or 'none',
            'cumulative_purchase_total_this_month': float(user.cumulative_purchase_total_this_month or 0),
            'internal_kyc_threshold_aed': float(PlatformConfig.get().internal_kyc_threshold_aed),
        }

    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}

    if not _has_light_identity(user, uploaded):
        pending_items.append({
            'section': 'identity',
            'label': 'Identity',
            'detail': 'Upload Emirates ID (residents) or passport + UAE visa page (visitors).',
            'key': 'light_id',
        })

    # Soft prompts for optional bank (needed later for sell-back payouts) — does not block trading
    try:
        bank = user.bank_details
        bank_ok = bank.status == CustomerBankDetails.VERIFIED
    except CustomerBankDetails.DoesNotExist:
        bank_ok = False

    cfg = PlatformConfig.get()
    ensure_monthly_bucket(user)
    threshold = Decimal(str(cfg.internal_kyc_threshold_aed))
    month_total = Decimal(str(user.cumulative_purchase_total_this_month or 0))
    income_status = getattr(user, 'income_proof_status', 'none') or 'none'

    trading_allowed = len(pending_items) == 0
    return {
        'status': 'verified' if trading_allowed else 'pending',
        'trading_allowed': trading_allowed,
        'pending_items': pending_items,
        'kyc_mode': 'light',
        'bank_verified': bank_ok,
        'income_proof_status': income_status,
        'cumulative_purchase_total_this_month': float(month_total),
        'internal_kyc_threshold_aed': float(threshold),
        'threshold_would_apply': bool(month_total >= threshold),
    }


def order_requires_income_proof(user, order_value) -> bool:
    cfg = PlatformConfig.get()
    ensure_monthly_bucket(user)
    threshold = Decimal(str(cfg.internal_kyc_threshold_aed))
    projected = Decimal(str(user.cumulative_purchase_total_this_month or 0)) + Decimal(str(order_value))
    if Decimal(str(order_value)) >= threshold or projected >= threshold:
        return (getattr(user, 'income_proof_status', '') or 'none') != 'verified'
    return False


def vendor_compliance_verification(user):
    pending_items = []

    if user.kyc_status == User.KYC_REJECTED:
        reason = (getattr(user, 'kyc_rejection_reason', '') or '').strip()
        detail = f'Your KYB application was rejected: {reason}' if reason else \
            'Your KYB application was rejected. Contact support to resubmit.'
        return {
            'status': 'rejected',
            'trading_allowed': False,
            'rejection_reason': reason,
            'pending_items': [{
                'section': 'identity',
                'label': 'KYB decision',
                'detail': detail,
            }],
        }

    if user.kyc_status != User.KYC_VERIFIED:
        pending_items.append({
            'section': 'identity',
            'label': 'Identity (KYB)',
            'detail': 'Awaiting Cridora admin approval after documents are complete.',
        })

    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    for dt in KYCDocument.VENDOR_DOCS:
        label = KYCDocument.DOC_TYPE_LABELS.get(dt, dt)
        doc = uploaded.get(dt)
        if not doc:
            if user.kyc_status != User.KYC_VERIFIED:
                pending_items.append({
                    'section': 'document',
                    'key': dt,
                    'label': label,
                    'detail': 'Document not uploaded.',
                })
            continue
        elif doc.status == KYCDocument.DOC_PENDING:
            pending_items.append({
                'section': 'document',
                'key': dt,
                'label': label,
                'detail': 'Pending admin verification.',
            })
        elif doc.status == KYCDocument.DOC_REJECTED:
            reason = (doc.rejection_reason or '').strip()
            pending_items.append({
                'section': 'document',
                'key': dt,
                'label': label,
                'detail': 'Rejected — re-upload required.'
                + (f' Note: {reason}' if reason else ''),
            })
        elif doc.status == KYCDocument.DOC_VERIFIED and doc.is_expired:
            pending_items.append({
                'section': 'document',
                'key': dt,
                'label': label,
                'detail': f'Expired on {doc.expiry_date} — re-upload a current document.',
            })

    trading_allowed = len(pending_items) == 0
    return {
        'status': 'verified' if trading_allowed else 'pending',
        'trading_allowed': trading_allowed,
        'pending_items': pending_items,
    }


def customer_ready_for_kyc_approval(user):
    """Admin can approve when light ID is verified (or legacy full set)."""
    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    return _has_light_identity(user, uploaded)


def vendor_ready_for_kyb_approval(user):
    uploaded = {
        d.doc_type: d
        for d in KYCDocument.objects.filter(user=user, status=KYCDocument.DOC_VERIFIED)
    }
    for dt in KYCDocument.VENDOR_DOCS:
        doc = uploaded.get(dt)
        if not doc or doc.is_expired:
            return False
    return True
