"""
Auto-draft Cridora→vendor bank payouts after EOD (idempotent, respects one payout per vendor per platform day).
"""
from typing import Optional, Tuple

from .cross_payments import platform_today_utc_bounds
from .models import AdminVendorPayout, EodVendorLedger, User


def vendor_has_non_cancelled_payout_today(vendor_id: int) -> bool:
    start_u, end_u, _, _ = platform_today_utc_bounds()
    return AdminVendorPayout.objects.filter(
        vendor_id=vendor_id,
        created_at__gte=start_u,
        created_at__lt=end_u,
    ).exclude(status=AdminVendorPayout.CANCELLED).exists()


def ensure_eod_draft_bank_payout(ledger: EodVendorLedger, admin_user: User) -> Tuple[Optional[AdminVendorPayout], Optional[str]]:
    """
    Caller must hold transaction.atomic and have locked this ledger row (select_for_update).
    Creates pending AdminVendorPayout, links OneToOne, sets ledger AWAITING_VENDOR.
    Returns (payout, None) or (None, skip_reason).
    """
    from decimal import Decimal

    leg = ledger
    pay = leg.payable_to_vendor_aed
    if leg.status != EodVendorLedger.PENDING_BANK:
        return None, "not_pending_bank"
    if pay <= Decimal("0.005"):
        return None, "not_positive_payable"

    existing = (
        AdminVendorPayout.objects.select_for_update()
        .filter(eod_ledger=leg)
        .exclude(status=AdminVendorPayout.CANCELLED)
        .first()
    )
    if existing:
        return existing, None

    if vendor_has_non_cancelled_payout_today(leg.vendor_id):
        return None, "vendor_already_has_payout_today"

    bd = leg.eod.business_date if leg.eod else None
    ref = f"EOD auto-draft run #{leg.eod_id} ledger #{leg.id} {bd or ''}".strip()

    p = AdminVendorPayout.objects.create(
        vendor=leg.vendor,
        amount_aed=leg.payable_to_vendor_aed,
        reference_note=ref[:2000],
        status=AdminVendorPayout.PENDING,
        created_by=admin_user,
        eod_ledger=leg,
    )
    leg.status = EodVendorLedger.AWAITING_VENDOR
    leg.save(update_fields=["status", "updated_at"])
    return p, None
