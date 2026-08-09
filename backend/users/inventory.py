"""
Stock reservation for buy orders — foundation for any order lifecycle feature.

Contract for new features that touch Order status:
  - Call `apply_order_status(order, new_status)` instead of assigning
    `order.status = ...` when leaving a reserved state. That helper releases
    reserved units on expire / reject / cancel and never double-releases.
  - Place-order must call `reserve_stock` inside the same atomic block as
    Order.objects.create.
  - Mark-paid must NOT decrement stock again (units were reserved at place).

stock_qty means units still available on the shelf (not reserved, not sold).
"""
from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import F

from users.models import CatalogProduct, Order

logger = logging.getLogger(__name__)

# Statuses that still hold a reservation (units not returned to shelf, not yet sold).
RESERVED_STATUSES = frozenset({
    Order.PENDING_VENDOR,
    Order.VENDOR_ACCEPTED,
    Order.PAYMENT_EXPIRED,  # soft window; hard cancel releases
})

# Leaving a reserved status for one of these → release stock back to shelf.
RELEASE_ON_STATUSES = frozenset({
    Order.EXPIRED,
    Order.REJECTED,
    Order.CANCELLED,
})


def reserve_stock(*, product_id: int, qty_units: int) -> tuple[bool, str | None]:
    """
    Atomically reserve qty_units from CatalogProduct.stock_qty.
    Caller should already be inside transaction.atomic() or this opens one.
    """
    if qty_units < 1:
        return False, 'qty'
    with transaction.atomic():
        product = CatalogProduct.objects.select_for_update().get(pk=product_id)
        if product.stock_qty < qty_units:
            return False, 'stock'
        product.stock_qty = F('stock_qty') - qty_units
        product.save(update_fields=['stock_qty'])
        product.refresh_from_db(fields=['stock_qty'])
        if product.stock_qty <= 0:
            product.in_stock = False
            product.save(update_fields=['in_stock'])
        return True, None


def release_stock(*, product_id: int, qty_units: int) -> None:
    """Return reserved units to the shelf (reject / expire / hard cancel)."""
    if qty_units < 1:
        return
    with transaction.atomic():
        product = CatalogProduct.objects.select_for_update().get(pk=product_id)
        product.stock_qty = F('stock_qty') + qty_units
        product.in_stock = True
        product.save(update_fields=['stock_qty', 'in_stock'])


def release_order_reservation(order: Order) -> bool:
    """
    Release stock for an order that is still in a reserved status.
    Idempotent w.r.t. status: only releases when current status is reserved.
    Returns True if stock was released.
    """
    if order.status not in RESERVED_STATUSES:
        return False
    release_stock(product_id=order.product_id, qty_units=int(order.qty_units))
    return True


def apply_order_status(order: Order, new_status: str, *, update_fields=None, save: bool = True) -> Order:
    """
    Set order.status with automatic reservation release.

    Use this from any new feature that cancels / expires / rejects an order.
    Does not release when moving reserved → held/paid (stock already consumed).
    """
    old = order.status
    if old in RESERVED_STATUSES and new_status in RELEASE_ON_STATUSES:
        release_order_reservation(order)
    order.status = new_status
    if save:
        fields = list(update_fields) if update_fields else ['status']
        if 'status' not in fields:
            fields.append('status')
        order.save(update_fields=fields)
    return order


def units_from_grams(*, qty_grams, weight_grams) -> int:
    """
    Exact unit count for sell-back stock restore: floor(qty/weight) with Decimal.
    Never uses float; never forces max(1, ...) which over-credits partial sells.
    """
    from cridora.money import ZERO, to_decimal

    w = to_decimal(weight_grams)
    q = to_decimal(qty_grams)
    if w <= ZERO or q <= ZERO:
        return 0
    return int(q // w)
