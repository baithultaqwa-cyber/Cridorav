"""
Single path to mark a buy order paid: stock, compliance snapshot, status → held (v7).
Used by manual confirm, Stripe webhook, and payments.service.
"""
import logging
from decimal import Decimal
from typing import Optional, Tuple

from django.db import transaction
from django.utils import timezone

from .models import CatalogProduct, Order, User

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
    On success status becomes Order.HELD (v7); PAID/CONFIRMED normalized to HELD.
    """
    if customer.id != order.customer_id or customer.user_type != User.CUSTOMER:
        return False, 'forbidden'
    if not trust_psp:
        from vendor_kyc.services import customer_may_complete_payment_for_order

        allowed, _pending = customer_may_complete_payment_for_order(customer, order)
        if not allowed:
            return False, 'compliance'
    if order.status in (Order.PAID, Order.HELD, Order.CONFIRMED):
        if order.status in (Order.PAID, Order.CONFIRMED):
            order.status = Order.HELD
            order.save(update_fields=['status'])
        return True, None
    if order.status == Order.EXPIRED:
        return False, 'expired'
    if order.status in (Order.REJECTED, Order.CANCELLED):
        return False, 'rejected'
    if getattr(order, 'income_proof_hold', False) and not trust_psp:
        if getattr(customer, 'income_proof_status', '') != 'verified':
            return False, 'income_proof'
    if order.status == Order.PAYMENT_EXPIRED:
        if not trust_psp:
            return False, 'not_ready'
        order.status = Order.VENDOR_ACCEPTED
        order.save(update_fields=['status'])
    if order.status != Order.VENDOR_ACCEPTED:
        return False, 'not_ready'
    with transaction.atomic():
        # Stock was reserved at place-order time (users.inventory.reserve_stock).
        # Do not decrement again here — that would double-charge inventory.
        # Lock the product row so concurrent cancel/expire cannot race with pay.
        CatalogProduct.objects.select_for_update().get(pk=order.product_id)
        order.status = Order.HELD
        order.compliance_gates_at_payment = True
        order.paid_at = timezone.now()
        fields = ['status', 'compliance_gates_at_payment', 'paid_at']
        if order.stripe_checkout_deadline is not None:
            order.stripe_checkout_deadline = None
            fields.append('stripe_checkout_deadline')
        order.save(update_fields=fields)

        try:
            _bump_cumulative_purchase(customer, order.total_aed)
        except Exception:
            logger.exception('cumulative purchase bump failed for order %s', order.id)

        try:
            from payments.service import sync_stripe_txn_on_paid
            sync_stripe_txn_on_paid(order)
        except Exception:
            pass

    return True, None


def _bump_cumulative_purchase(customer, amount):
    month_key = timezone.now().strftime('%Y-%m')
    user = User.objects.select_for_update().get(pk=customer.pk)
    if user.cumulative_purchase_month_key != month_key:
        user.cumulative_purchase_month_key = month_key
        user.cumulative_purchase_total_this_month = Decimal('0')
    user.cumulative_purchase_total_this_month = (
        Decimal(str(user.cumulative_purchase_total_this_month or 0)) + Decimal(str(amount))
    )
    user.cumulative_purchase_total = (
        Decimal(str(user.cumulative_purchase_total or 0)) + Decimal(str(amount))
    )
    user.save(update_fields=[
        'cumulative_purchase_month_key',
        'cumulative_purchase_total_this_month',
        'cumulative_purchase_total',
    ])
