"""
Single path to mark a buy order paid: stock, compliance snapshot, status.
Used by manual POST (dev / emergency) and Stripe webhook.
"""
import logging
from decimal import Decimal
from typing import Optional, Tuple

from .compliance import customer_compliance_verification
from .models import Order, User

logger = logging.getLogger(__name__)


def aed_to_stripe_minor_units(total_aed) -> int:
    """AED: 2 decimal places; Stripe amount in minor units (fils)."""
    d = total_aed if isinstance(total_aed, Decimal) else Decimal(str(total_aed))
    return int((d * 100).quantize(Decimal('1')))


def apply_mark_order_paid_for_customer(
    order, customer, *, trust_psp: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Mutates order and product; caller must hold order row locked (select_for_update).
    trust_psp: Stripe path after payment is captured—skip duplicate KYC gate; if stock is
    short, still complete and log (avoids successful Stripe charge with order stuck unpaid).
    """
    if customer.id != order.customer_id or customer.user_type != User.CUSTOMER:
        return False, 'forbidden'
    if not trust_psp:
        c = customer_compliance_verification(customer)
        if not c['trading_allowed']:
            return False, 'compliance'
    if order.status == Order.PAID:
        return True, None
    if order.status == Order.EXPIRED:
        return False, 'expired'
    if order.status == Order.REJECTED:
        return False, 'rejected'
    if order.status == Order.PAYMENT_EXPIRED:
        if not trust_psp:
            return False, 'not_ready'
        order.status = Order.VENDOR_ACCEPTED
        order.save(update_fields=['status'])
    if order.status != Order.VENDOR_ACCEPTED:
        return False, 'not_ready'
    product = order.product
    if product.stock_qty < order.qty_units:
        if not trust_psp:
            return False, 'stock'
        logger.warning(
            "Mark paid (Stripe): order %s stock short (have %s, need %s) — completing anyway",
            order.id,
            product.stock_qty,
            order.qty_units,
        )
    product.stock_qty -= order.qty_units
    if product.stock_qty <= 0:
        product.in_stock = False
    product.save(update_fields=['stock_qty', 'in_stock'])
    order.status = Order.PAID
    order.compliance_gates_at_payment = True
    if order.stripe_checkout_deadline is not None:
        order.stripe_checkout_deadline = None
        order.save(update_fields=['status', 'compliance_gates_at_payment', 'stripe_checkout_deadline'])
    else:
        order.save(update_fields=['status', 'compliance_gates_at_payment'])
    return True, None
