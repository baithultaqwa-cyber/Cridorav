"""
Stripe Checkout session deadline: if customer does not complete payment in time, expire
the session in Stripe and set order to PAYMENT_EXPIRED.
"""
import logging
from datetime import timedelta
from typing import Optional

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Order

logger = logging.getLogger(__name__)


def stripe_checkout_deadline_seconds() -> int:
    raw = getattr(settings, "STRIPE_CHECKOUT_DEADLINE_SECONDS", 300)
    try:
        s = int(raw)
    except (TypeError, ValueError):
        s = 300
    return max(60, min(s, 3600))


def _stripe_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def maybe_expire_stripe_checkout_order(order_id: int) -> bool:
    """
    If the order is vendor_accepted with a Stripe session and the deadline passed, either
    complete the order from Stripe (if already paid) or expire the session and set PAYMENT_EXPIRED.

    Returns True if the order row was updated (caller should refresh from DB).
    """
    if not _stripe_configured():
        return False
    stripe.api_key = settings.STRIPE_SECRET_KEY
    with transaction.atomic():
        try:
            order = (
                Order.objects.select_for_update()
                .select_related("customer", "product")
                .get(pk=order_id)
            )
        except Order.DoesNotExist:
            return False
        if order.status != Order.VENDOR_ACCEPTED:
            return False
        sid = (order.stripe_checkout_session_id or "").strip()
        if not sid:
            return False
        dl = order.stripe_checkout_deadline
        if dl is None or timezone.now() < dl:
            return False
        try:
            remote = stripe.checkout.Session.retrieve(sid, expand=["payment_intent"])
        except stripe.error.StripeError as e:
            logger.warning("Checkout expiry: Session.retrieve failed order=%s: %s", order_id, e)
            return False
        from .payment_stripe import _coerce_session_dict

        rs = _coerce_session_dict(remote)
        pay = rs.get("payment_status") or ""
        st = rs.get("status") or ""
        if pay in ("paid", "no_payment_required"):
            from .payment_stripe import _apply_checkout_session_paid

            dedupe = f"deadline_recover_{sid}"[:255]
            try:
                _apply_checkout_session_paid(rs, dedupe)
            except Exception as e:
                logger.exception("Checkout expiry: mark paid failed order=%s: %s", order_id, e)
            return True
        try:
            if st == "open":
                stripe.checkout.Session.expire(sid)
        except stripe.error.InvalidRequestError:
            pass
        except stripe.error.StripeError as e:
            logger.warning("Checkout expiry: Session.expire failed order=%s: %s", order_id, e)
        order.status = Order.PAYMENT_EXPIRED
        order.stripe_checkout_session_id = None
        order.stripe_checkout_deadline = None
        order.save(
            update_fields=["status", "stripe_checkout_session_id", "stripe_checkout_deadline"]
        )
        return True


def expire_due_stripe_checkout_orders(limit: int = 500) -> int:
    """Batch job: expire all orders past deadline. Returns count of rows updated."""
    if not _stripe_configured():
        return 0
    now = timezone.now()
    ids = list(
        Order.objects.filter(
            status=Order.VENDOR_ACCEPTED,
            stripe_checkout_deadline__lt=now,
        )
        .exclude(stripe_checkout_session_id__isnull=True)
        .exclude(stripe_checkout_session_id="")
        .values_list("id", flat=True)[:limit]
    )
    n = 0
    for oid in ids:
        if maybe_expire_stripe_checkout_order(oid):
            n += 1
    return n


def set_checkout_deadline_on_order(order, seconds: Optional[int] = None) -> None:
    sec = seconds if seconds is not None else stripe_checkout_deadline_seconds()
    order.stripe_checkout_deadline = timezone.now() + timedelta(seconds=sec)
