"""
Strict verification: trading only when admin identity is approved and every
required document + (for customers) bank is verified.
"""
from django.core.exceptions import ObjectDoesNotExist

from .models import User, KYCDocument, CustomerBankDetails


def customer_compliance_verification(user):
    pending_items = []

    if user.kyc_status == User.KYC_REJECTED:
        return {
            'status': 'rejected',
            'trading_allowed': False,
            'pending_items': [{
                'section': 'identity',
                'label': 'KYC decision',
                'detail': 'Your KYC application was rejected. Contact support to resubmit.',
            }],
        }

    if user.kyc_status != User.KYC_VERIFIED:
        pending_items.append({
            'section': 'identity',
            'label': 'Identity (KYC)',
            'detail': 'Awaiting Cridora admin approval of your KYC application.',
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

    try:
        bank = user.bank_details
        bs = bank.status
    except ObjectDoesNotExist:
        bs = CustomerBankDetails.NOT_ADDED

    if bs == CustomerBankDetails.NOT_ADDED:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank account',
            'detail': 'Add and verify your bank details for settlements and payouts.',
        })
    elif bs == CustomerBankDetails.PENDING:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank account',
            'detail': 'Bank details pending admin verification.',
        })
    elif bs == CustomerBankDetails.REJECTED:
        pending_items.append({
            'section': 'bank',
            'label': 'Bank account',
            'detail': 'Bank details rejected — update and resubmit.',
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
        return {
            'status': 'rejected',
            'trading_allowed': False,
            'pending_items': [{
                'section': 'identity',
                'label': 'KYB decision',
                'detail': 'Your KYB application was rejected. Contact support to resubmit.',
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
    try:
        bank = user.bank_details
    except ObjectDoesNotExist:
        return (False, 'Bank details must be added and verified before KYC approval.')
    if bank.status != CustomerBankDetails.VERIFIED:
        return (False, 'Bank details must be verified before KYC approval.')
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
    return (True, None)
