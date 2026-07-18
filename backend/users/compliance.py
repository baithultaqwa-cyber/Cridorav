"""
Strict verification: trading only when admin identity is approved and every
required KYC document plus verified customer bank details (bank is part of KYC).
"""
from .models import User, KYCDocument, CustomerBankDetails


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
        }

    if user.kyc_status != User.KYC_VERIFIED:
        pending_items.append({
            'section': 'identity',
            'label': 'Identity (KYC)',
            'detail': 'Awaiting Cridora admin approval after documents and bank details are complete.',
        })

    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    for dt in KYCDocument.CUSTOMER_DOCS:
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

    try:
        bank = user.bank_details
        bs = bank.status
    except CustomerBankDetails.DoesNotExist:
        bs = CustomerBankDetails.NOT_ADDED

    if bs == CustomerBankDetails.NOT_ADDED:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank details (KYC)',
            'detail': 'Add your bank account as part of KYC — required for settlements and payouts.',
        })
    elif bs == CustomerBankDetails.PENDING:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank details (KYC)',
            'detail': 'Bank details pending admin verification (part of KYC).',
        })
    elif bs == CustomerBankDetails.REJECTED:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank details (KYC)',
            'detail': 'Bank details rejected — update and resubmit to complete KYC.',
        })

    trading_allowed = len(pending_items) == 0
    return {
        'status': 'verified' if trading_allowed else 'pending',
        'trading_allowed': trading_allowed,
        'pending_items': pending_items,
    }


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
            'label': 'Business (KYB)',
            'detail': 'Awaiting Cridora admin approval of your KYB application.',
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


def customer_needs_admin_review(user):
    """True while the customer is not fully cleared for trading (any KYC/doc/bank follow-up)."""
    if user.user_type != User.CUSTOMER:
        return False
    return not customer_compliance_verification(user)['trading_allowed']


def vendor_needs_admin_review(user):
    """True while the vendor is not fully cleared for trading (any KYB/doc follow-up)."""
    if user.user_type != User.VENDOR:
        return False
    return not vendor_compliance_verification(user)['trading_allowed']


def customer_ready_for_kyc_approval(user):
    """
    Admin may approve KYC only when every required document is uploaded and verified
    and bank details are verified.
    Returns (True, None) or (False, error_message).
    """
    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    for dt in KYCDocument.CUSTOMER_DOCS:
        doc = uploaded.get(dt)
        if not doc or doc.status != KYCDocument.DOC_VERIFIED:
            return (
                False,
                'Approve KYC only after every required document is uploaded and verified.',
            )
        if dt in KYCDocument.EXPIRY_REQUIRED_DOC_TYPES:
            if not doc.expiry_date:
                return (False, f'{KYCDocument.DOC_TYPE_LABELS.get(dt, dt)} is missing an expiry date.')
            if doc.is_expired:
                return (False, f'{KYCDocument.DOC_TYPE_LABELS.get(dt, dt)} has expired — a current document is required.')
    try:
        bank = user.bank_details
    except CustomerBankDetails.DoesNotExist:
        return (False, 'Bank details must be added and verified as part of KYC before admin approval.')
    if bank.status != CustomerBankDetails.VERIFIED:
        return (False, 'Bank details must be verified as part of KYC before admin approval.')
    return (True, None)


def vendor_ready_for_kyb_approval(user):
    """
    Admin may approve KYB only when every required document is uploaded and verified.
    Returns (True, None) or (False, error_message).
    """
    uploaded = {d.doc_type: d for d in KYCDocument.objects.filter(user=user)}
    for dt in KYCDocument.VENDOR_DOCS:
        doc = uploaded.get(dt)
        if not doc or doc.status != KYCDocument.DOC_VERIFIED:
            return (
                False,
                'Approve KYB only after every required document is uploaded and verified.',
            )
        if dt in KYCDocument.EXPIRY_REQUIRED_DOC_TYPES:
            if not doc.expiry_date:
                return (False, f'{KYCDocument.DOC_TYPE_LABELS.get(dt, dt)} is missing an expiry date.')
            if doc.is_expired:
                return (False, f'{KYCDocument.DOC_TYPE_LABELS.get(dt, dt)} has expired — a current document is required.')
        if dt == KYCDocument.INSURANCE_CERTIFICATE and not doc.declared_value_aed:
            return (False, 'Insurance Certificate is missing its declared coverage amount (AED).')
    return (True, None)
