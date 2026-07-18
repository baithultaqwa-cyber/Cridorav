"""
Manual per-vendor KYC services.

For vendors with VendorKycAccess.enabled=True, the dealer's verification is the
sole gate for that vendor (independent of global platform KYC).
For vendors without access, callers should keep using the existing global
customer_compliance_verification gate.
"""
from django.db import transaction
from django.utils import timezone

from users.models import User

from .models import VendorCustomerVerification, VendorKycAccess, VendorKycAuditLog

PENDING_MESSAGE = (
    'This dealer manually verifies customers. Your verification is pending and '
    'may take 30 minutes up to 24 hours.'
)
REJECTED_MESSAGE = (
    'This dealer has not approved your verification. You cannot purchase from '
    'this dealer until they verify you. You can still buy from other vendors.'
)


def vendor_requires_manual_kyc(vendor) -> bool:
    if not vendor or getattr(vendor, 'user_type', None) != User.VENDOR:
        return False
    try:
        access = vendor.manual_kyc_access
    except VendorKycAccess.DoesNotExist:
        return False
    return bool(access.enabled)


def get_verification_status(vendor, customer) -> str | None:
    if not vendor or not customer:
        return None
    row = (
        VendorCustomerVerification.objects.filter(vendor=vendor, customer=customer)
        .values_list('status', flat=True)
        .first()
    )
    return row


def _write_audit(
    *,
    vendor,
    actor,
    action,
    customer=None,
    previous_status='',
    new_status='',
    notes='',
):
    VendorKycAuditLog.objects.create(
        vendor=vendor,
        customer=customer,
        actor=actor,
        action=action,
        previous_status=previous_status or '',
        new_status=new_status or '',
        notes=notes or '',
    )


def ensure_pending_verification(vendor, customer, actor=None, notify=True):
    """
    Lazily create a pending verification row (e.g. on first buy attempt).
    Returns (row, created).
    """
    row, created = VendorCustomerVerification.objects.get_or_create(
        vendor=vendor,
        customer=customer,
        defaults={'status': VendorCustomerVerification.PENDING},
    )
    if created:
        _write_audit(
            vendor=vendor,
            customer=customer,
            actor=actor or customer,
            action=VendorKycAuditLog.VERIFICATION_REQUESTED,
            previous_status='',
            new_status=VendorCustomerVerification.PENDING,
            notes='Auto-created on purchase attempt or customer request.',
        )
        if notify:
            _notify_vendor_new_request(vendor, customer)
    return row, created


def can_customer_buy_from_vendor(vendor, customer):
    """
    Returns (allowed: bool, code: str|None, message: str).

    When manual KYC is enabled for the vendor:
      - verified → allowed
      - pending / none → blocked with VENDOR_KYC_PENDING (auto-creates pending)
      - rejected → blocked with VENDOR_KYC_REJECTED
    When manual KYC is disabled, returns (True, None, '') — caller must apply
    the global compliance gate separately.
    """
    if not vendor_requires_manual_kyc(vendor):
        return True, None, ''

    row = (
        VendorCustomerVerification.objects.filter(vendor=vendor, customer=customer).first()
    )
    if row is None:
        ensure_pending_verification(vendor, customer, actor=customer, notify=True)
        return False, 'VENDOR_KYC_PENDING', PENDING_MESSAGE

    if row.status == VendorCustomerVerification.VERIFIED:
        return True, None, ''

    if row.status == VendorCustomerVerification.REJECTED:
        return False, 'VENDOR_KYC_REJECTED', REJECTED_MESSAGE

    # pending (or unexpected)
    return False, 'VENDOR_KYC_PENDING', PENDING_MESSAGE


def customer_may_complete_payment_for_order(customer, order) -> tuple[bool, list]:
    """
    Payment / mark-paid gate aligned with place-order rules.
    Manual-KYC vendors: dealer verification is enough.
    Other vendors: global customer_compliance_verification.
    Returns (allowed, pending_items_list).
    """
    vendor = getattr(getattr(order, 'product', None), 'vendor', None)
    if vendor is None:
        try:
            vendor = order.product.vendor
        except Exception:
            return False, [{'label': 'Order', 'detail': 'Vendor missing on order.'}]

    if vendor_requires_manual_kyc(vendor):
        st = get_verification_status(vendor, customer)
        if st == VendorCustomerVerification.VERIFIED:
            return True, []
        return False, [{
            'label': 'Dealer verification',
            'detail': REJECTED_MESSAGE if st == VendorCustomerVerification.REJECTED else PENDING_MESSAGE,
        }]

    from users.compliance import customer_compliance_verification
    c = customer_compliance_verification(customer)
    return bool(c.get('trading_allowed')), list(c.get('pending_items') or [])


@transaction.atomic
def set_vendor_access(vendor, enabled: bool, admin_user, notes: str = ''):
    if vendor.user_type != User.VENDOR:
        raise ValueError('Target user is not a vendor.')
    access, _ = VendorKycAccess.objects.select_for_update().get_or_create(vendor=vendor)
    prev = access.enabled
    access.enabled = bool(enabled)
    access.notes = (notes or '').strip()
    if enabled and not prev:
        access.granted_by = admin_user
        access.granted_at = timezone.now()
    access.save()
    _write_audit(
        vendor=vendor,
        actor=admin_user,
        action=VendorKycAuditLog.ACCESS_GRANTED if enabled else VendorKycAuditLog.ACCESS_REVOKED,
        previous_status='enabled' if prev else 'disabled',
        new_status='enabled' if enabled else 'disabled',
        notes=notes,
    )
    return access


@transaction.atomic
def decide_verification(vendor, customer, decided_by, approve: bool, reason: str = ''):
    if vendor.user_type != User.VENDOR:
        raise ValueError('Target user is not a vendor.')
    if customer.user_type != User.CUSTOMER:
        raise ValueError('Target user is not a customer.')
    if not vendor_requires_manual_kyc(vendor):
        raise PermissionError('This vendor does not have manual KYC access enabled.')

    row, _ = VendorCustomerVerification.objects.select_for_update().get_or_create(
        vendor=vendor,
        customer=customer,
        defaults={'status': VendorCustomerVerification.PENDING},
    )
    previous = row.status
    new_status = (
        VendorCustomerVerification.VERIFIED if approve else VendorCustomerVerification.REJECTED
    )
    row.status = new_status
    row.decided_by = decided_by
    row.decided_at = timezone.now()
    row.reason = (reason or '').strip()
    row.save()

    action = VendorKycAuditLog.VERIFIED if approve else VendorKycAuditLog.REJECTED
    if previous == VendorCustomerVerification.VERIFIED and not approve:
        action = VendorKycAuditLog.REVERTED
    elif previous == VendorCustomerVerification.REJECTED and approve:
        action = VendorKycAuditLog.VERIFIED

    _write_audit(
        vendor=vendor,
        customer=customer,
        actor=decided_by,
        action=action,
        previous_status=previous,
        new_status=new_status,
        notes=reason,
    )

    _notify_customer_decision(vendor, customer, approve=approve, reason=reason)
    return row


def verification_to_dict(row: VendorCustomerVerification) -> dict:
    c = row.customer
    return {
        'id': row.id,
        'vendor_id': row.vendor_id,
        'customer_id': row.customer_id,
        'customer_email': c.email,
        'customer_name': c.get_full_name() or c.email,
        'customer_phone': c.phone or '',
        'status': row.status,
        'requested_at': row.requested_at.isoformat() if row.requested_at else None,
        'decided_at': row.decided_at.isoformat() if row.decided_at else None,
        'reason': row.reason or '',
    }


def access_to_dict(access: VendorKycAccess) -> dict:
    return {
        'vendor_id': access.vendor_id,
        'enabled': access.enabled,
        'notes': access.notes or '',
        'granted_at': access.granted_at.isoformat() if access.granted_at else None,
        'granted_by_id': access.granted_by_id,
        'updated_at': access.updated_at.isoformat() if access.updated_at else None,
    }


def _notify_vendor_new_request(vendor, customer):
    try:
        from notifications.services import create_and_send

        name = customer.get_full_name() or customer.email
        create_and_send(
            vendor,
            category='vendor_kyc',
            title='New customer verification request',
            body=f'{name} requested verification to buy from you. Review in Customer Verification.',
            url='/dashboard/vendor?section=customer_kyc',
            data={'customer_id': customer.id},
        )
    except Exception:
        # Notifications must never break the KYC flow.
        pass


def _notify_customer_decision(vendor, customer, approve: bool, reason: str = ''):
    try:
        from notifications.services import create_and_send

        dealer = vendor.vendor_company or vendor.get_full_name() or vendor.email
        if approve:
            title = 'Dealer verification approved'
            body = f'{dealer} has verified you. You can now purchase from this dealer.'
        else:
            title = 'Dealer verification declined'
            body = (
                f'{dealer} could not verify you at this time. '
                + (f'Reason: {reason}' if reason else 'You can still buy from other vendors.')
            )
        create_and_send(
            customer,
            category='vendor_kyc',
            title=title,
            body=body,
            url='/marketplace',
            data={'vendor_id': vendor.id, 'approved': approve},
        )
    except Exception:
        pass
