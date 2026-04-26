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
from django.db.models import Q
from django.utils import timezone

from .models import Order, PlatformConfig

logger = logging.getLogger(__name__)


def stripe_checkout_deadline_seconds() -> int:
    raw = getattr(settings, "STRIPE_CHECKOUT_DEADLINE_SECONDS", 300)
    try:
        s = int(raw)
    except (TypeError, ValueError):
        s = 300
    return max(60, min(s, 3600))


def payment_completion_deadline_seconds() -> int:
    try:
        cfg = PlatformConfig.get()
        sec = int(getattr(cfg, "payment_complete_ttl_seconds", 300) or 300)
    except Exception:
        sec = 300
    return max(60, min(sec, 86400))


def _stripe_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def maybe_expire_stripe_checkout_order(order_id: int) -> bool:
    return maybe_expire_order_payment_window(order_id)


def effective_payment_deadline(order):
    """
    Earliest of admin payment window and Stripe checkout deadline (when both exist).
    Avoids leaving orders in vendor_accepted after the checkout session is no longer usable.
    """
    pe = getattr(order, "payment_expires_at", None)
    sd = getattr(order, "stripe_checkout_deadline", None)
    candidates = [x for x in (pe, sd) if x is not None]
    if not candidates:
        return None
    return min(candidates)


def maybe_expire_order_payment_window(order_id: int) -> bool:
    """
    If the order is vendor_accepted and the payment deadline passed, either complete from
    Stripe (if paid) or cancel and mark PAYMENT_EXPIRED.

    Returns True if the order row was updated (caller should refresh from DB).
    """
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
        dl = effective_payment_deadline(order)
        if dl is None or timezone.now() < dl:
            return False
        if sid and _stripe_configured():
            stripe.api_key = settings.STRIPE_SECRET_KEY
            remote = None
            try:
                remote = stripe.checkout.Session.retrieve(sid, expand=["payment_intent"])
            except stripe.error.StripeError as e:
                logger.warning(
                    "Checkout expiry: Session.retrieve failed order=%s (will mark PAYMENT_EXPIRED): %s",
                    order_id,
                    e,
                )
            if remote is not None:
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
        order.payment_expires_at = None
        order.save(
            update_fields=["status", "stripe_checkout_session_id", "stripe_checkout_deadline", "payment_expires_at"]
        )
        return True


def expire_due_stripe_checkout_orders(limit: int = 500) -> int:
    """Batch job: expire all vendor-accepted orders past payment deadline."""
    now = timezone.now()
    # Include rows where either deadline is past (full evaluation uses min(pe, sd) in maybe_expire).
    ids = list(
        Order.objects.filter(
            status=Order.VENDOR_ACCEPTED,
        )
        .filter(
            Q(payment_expires_at__lt=now) | Q(stripe_checkout_deadline__lt=now),
        )
        .values_list("id", flat=True)[:limit]
    )
    n = 0
    for oid in ids:
        if maybe_expire_order_payment_window(oid):
            n += 1
    return n


def set_checkout_deadline_on_order(order, seconds: Optional[int] = None) -> None:
    sec = seconds if seconds is not None else stripe_checkout_deadline_seconds()
    checkout_deadline = timezone.now() + timedelta(seconds=sec)
    payment_deadline = getattr(order, "payment_expires_at", None)
    if payment_deadline is not None:
        order.stripe_checkout_deadline = min(checkout_deadline, payment_deadline)
        return
    order.stripe_checkout_deadline = checkout_deadline
