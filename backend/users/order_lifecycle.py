"""Order accept / re-quote / hard-expiry helpers (v7 §5.1 + principal-trading)."""
from datetime import timedelta
import logging

from django.db import transaction
from django.utils import timezone

from users.models import Order, PlatformConfig

logger = logging.getLogger(__name__)


def lock_rate_on_vendor_accept(order: Order, *, cfg=None) -> Order:
    """Vendor acceptance locks the quoted rate and opens the payment window."""
    cfg = cfg or PlatformConfig.get()
    now = timezone.now()
    soft = int(cfg.payment_complete_ttl_seconds or 300)
    hard_h = int(getattr(cfg, 'order_hard_expiry_hours', 48) or 48)
    # Also refresh rate-lock window for replenishment secure (config knob).
    lock_s = int(getattr(cfg, 'rate_lock_window_seconds', 120) or 120)
    soft = max(soft, lock_s)
    order.vendor_accepted_at = now
    order.payment_window_expires_at = now + timedelta(seconds=soft)
    order.payment_expires_at = order.payment_window_expires_at
    order.order_hard_expiry_at = now + timedelta(hours=hard_h)
    order.status = Order.VENDOR_ACCEPTED
    order.save(
        update_fields=[
            'vendor_accepted_at',
            'payment_window_expires_at',
            'payment_expires_at',
            'order_hard_expiry_at',
            'status',
        ]
    )
    return order


@transaction.atomic
def maybe_requote_or_hard_expire(order_id: int) -> Order:
    """
    Soft window expired → re-quote via principal-trading engine and reset window.
    If the new quote fails the min-profit floor, keep the previously locked rates
    (do not cancel / do not lock a loss-making refresh) and reopen the soft window.
    Hard outer expiry → cancel and release reservation.
    """
    order = Order.objects.select_for_update().select_related(
        'product', 'product__vendor', 'product__vendor__pricing_config', 'customer',
    ).get(pk=order_id)
    if order.status not in (Order.VENDOR_ACCEPTED, Order.PAYMENT_EXPIRED):
        return order
    now = timezone.now()
    cfg = PlatformConfig.get()

    if order.order_hard_expiry_at and now >= order.order_hard_expiry_at:
        from users.inventory import apply_order_status
        apply_order_status(order, Order.CANCELLED)
        return order

    window = order.payment_window_expires_at or order.payment_expires_at
    if not window or now < window:
        return order

    from cridora.order_pricing import apply_quote_to_order, build_locked_quote

    provider = order.payment_provider or 'manual_aani'
    soft = int(cfg.payment_complete_ttl_seconds or 300)
    lock_s = int(getattr(cfg, 'rate_lock_window_seconds', 120) or 120)
    soft = max(soft, lock_s)

    quote = build_locked_quote(
        product=order.product,
        qty_grams=order.qty_grams,
        provider_key=provider,
        cfg=cfg,
        enforce_floor=True,
    )

    update_fields = [
        'requoted_count', 'payment_window_expires_at', 'payment_expires_at',
        'status', 'stripe_checkout_session_id', 'stripe_checkout_deadline',
    ]

    if quote.floor_ok and quote.charged_rate > 0:
        fields = apply_quote_to_order(order, quote, provider_key=provider)
        update_fields.extend(fields)
    else:
        # Keep locked customer rate — soft-window refresh must not cancel a paid-intent order.
        logger.warning(
            'requote skipped rate refresh for order %s: %s',
            order.id,
            quote.floor_block_reason or 'invalid quote',
        )

    order.requoted_count = (order.requoted_count or 0) + 1
    order.payment_window_expires_at = now + timedelta(seconds=soft)
    order.payment_expires_at = order.payment_window_expires_at
    order.status = Order.VENDOR_ACCEPTED
    order.stripe_checkout_session_id = None
    order.stripe_checkout_deadline = None
    order.save(update_fields=list(dict.fromkeys(update_fields)))
    return order
