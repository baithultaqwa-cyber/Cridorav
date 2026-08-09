"""
Cridora foundation contracts — import from here when building new features.

Money / precision (never use float for AED, grams, or rates in business logic):
    from cridora.money import money_aed, rate_4dp, grams, mul_money, pct_of, to_decimal
    from payments.fees import buy_fee_breakdown, buy_fee_breakdown_api, sellback_fee_breakdown

Inventory / order lifecycle (never assign order.status for cancel/expire/reject by hand):
    from users.inventory import reserve_stock, apply_order_status, units_from_grams
    # place-order: reserve_stock inside the same atomic as Order.objects.create
    # cancel/expire/reject: apply_order_status(order, Order.CANCELLED)
    # mark-paid: do NOT decrement stock again

AuthZ (prefer declarative permissions over in-view user_type checks):
    from security.permissions import IsAdmin, IsVendor, IsCustomer, IsOwnerOrAdmin
    permission_classes = [IsAuthenticated, IsAdmin]

List pagination (opt-in — do not break existing bare-array list endpoints):
    from security.pagination import StandardPagination

Password validation (every set-password path):
    from security.validation import password_error

Secrets:
    - Provider keys stay in env (Stripe/Telr/VAPID), never DB
    - Feed/SMS secrets: store server-side, return hints only in API
    - OTP: hash with otp.services.hash_otp / codes_match
"""

from security.pagination import CompactPagination, StandardPagination
from security.permissions import (
    IsAdmin,
    IsAdminOrVendor,
    IsCustomer,
    IsOwnerOrAdmin,
    IsVendor,
    ReadOnly,
)

__all__ = [
    'IsAdmin',
    'IsAdminOrVendor',
    'IsCustomer',
    'IsOwnerOrAdmin',
    'IsVendor',
    'ReadOnly',
    'StandardPagination',
    'CompactPagination',
]
