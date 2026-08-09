"""Order accept / re-quote / hard-expiry helpers (v7 §5.1)."""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from users.models import Order, PlatformConfig
from payments.fees import buy_fee_breakdown, round_aed


def lock_rate_on_vendor_accept(order: Order, *, cfg=None) -> Order:
    """Vendor acceptance locks the quoted rate and opens the payment window."""
    cfg = cfg or PlatformConfig.get()
    now = timezone.now()
    soft = int(cfg.payment_complete_ttl_seconds or 300)
    hard_h = int(getattr(cfg, 'order_hard_expiry_hours', 48) or 48)
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
    Soft window expired → re-quote at live listing rate and reset window (v7).
    Hard outer expiry → cancel and release reservation.
    """
    order = Order.objects.select_for_update().select_related('product', 'customer').get(pk=order_id)
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

    # Re-quote from current product effective rates (Decimal end-to-end)
    from cridora.money import rate_4dp, to_decimal
    from payments.fees import buy_fee_breakdown_api

    product = order.product
    rate = rate_4dp(product.final_rate_per_gram())
    metal_rate = rate_4dp(product.effective_rate())
    if metal_rate <= 0:
        metal_rate = rate
    buyback = rate_4dp(product.effective_buyback_per_gram())
    qty_g = to_decimal(order.qty_grams)
    metal_sub = round_aed(rate * qty_g)
    provider = order.payment_provider or 'manual_aani'
    breakdown = buy_fee_breakdown(metal_subtotal_aed=metal_sub, provider_key=provider, cfg=cfg)
    service = breakdown['cridora_service_fee_aed']
    total = breakdown['total_due_now_aed']

    soft = int(cfg.payment_complete_ttl_seconds or 300)
    order.rate_per_gram = rate
    order.metal_rate_per_gram = metal_rate
    order.buyback_per_gram = buyback
    order.platform_fee_aed = service
    order.total_aed = total
    order.fees_breakdown = buy_fee_breakdown_api(
        metal_subtotal_aed=metal_sub, provider_key=provider, cfg=cfg
    )
    order.requoted_count = (order.requoted_count or 0) + 1
    order.payment_window_expires_at = now + timedelta(seconds=soft)
    order.payment_expires_at = order.payment_window_expires_at
    order.status = Order.VENDOR_ACCEPTED
    order.stripe_checkout_session_id = None
    order.stripe_checkout_deadline = None
    order.save()
    return order
