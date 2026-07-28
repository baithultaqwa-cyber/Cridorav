"""
Notification creation + Web Push delivery.

Entry points used by other apps (orders, vendor_kyc, price alerts).
Never raise into callers — swallow and log so trading flows stay safe.
"""
import logging

from django.conf import settings
from django.utils import timezone

from users.models import Order, User

from .models import AdminBroadcastLog, Notification, PushSubscription
from .push_backend import send_web_push, vapid_configured

logger = logging.getLogger(__name__)


def notification_to_dict(n: Notification) -> dict:
    return {
        'id': n.id,
        'category': n.category,
        'title': n.title,
        'body': n.body,
        'url': n.url or '',
        'data': n.data or {},
        'created_at': n.created_at.isoformat() if n.created_at else None,
        'read_at': n.read_at.isoformat() if n.read_at else None,
        'unread': n.read_at is None,
    }


def _push_to_guest_subscribers(title, body, url=None, data=None, exclude_endpoints=None, category=''):
    """
    Raw Web Push to anonymous (not signed in) subscribers. There is no `Notification.recipient`
    to attach these to (guests have no User row), so this bypasses `create_and_send` and pushes
    directly. Deactivates subscriptions the push service reports as gone (404/410).
    """
    if not vapid_configured():
        return 0
    qs = PushSubscription.objects.filter(user__isnull=True, is_active=True)
    if exclude_endpoints:
        qs = qs.exclude(endpoint__in=exclude_endpoints)
    payload = {
        'title': (title or '')[:200],
        'body': body or '',
        'url': url or '/',
        'category': category or '',
        'data': data or {},
    }
    sent = 0
    for sub in qs.iterator(chunk_size=200):
        ok, err = send_web_push(sub, payload)
        if ok:
            sent += 1
        elif err == 'gone':
            PushSubscription.objects.filter(pk=sub.pk).update(is_active=False)
    return sent


def create_and_send(user, category, title, body, url=None, data=None):
    """Persist an in-app notification and attempt Web Push to all active subs."""
    if not user:
        return None
    try:
        n = Notification.objects.create(
            recipient=user,
            category=category,
            title=(title or '')[:200],
            body=body or '',
            url=(url or '')[:500],
            data=data or {},
        )
    except Exception:
        logger.exception('Failed to create notification for user %s', getattr(user, 'id', None))
        return None

    if not vapid_configured():
        return n

    payload = {
        'title': n.title,
        'body': n.body,
        'url': n.url or '/',
        'category': n.category,
        'notification_id': n.id,
        'data': n.data or {},
    }
    subs = PushSubscription.objects.filter(user=user, is_active=True)
    any_ok = False
    last_err = ''
    for sub in subs:
        ok, err = send_web_push(sub, payload)
        if ok:
            any_ok = True
        elif err == 'gone':
            PushSubscription.objects.filter(pk=sub.pk).update(is_active=False)
        else:
            last_err = err
    if any_ok:
        Notification.objects.filter(pk=n.pk).update(push_sent=True)
    elif last_err:
        Notification.objects.filter(pk=n.pk).update(push_error=last_err[:500])
    return n


def notify_new_order(order: Order):
    """Dealer tray alert when a customer places a buy order."""
    try:
        vendor = order.product.vendor
        metal = (order.product.metal or 'metal').title()
        grams = float(order.qty_grams)
        create_and_send(
            vendor,
            category=Notification.ORDER_NEW,
            title='New order received',
            body=f'{metal} · {grams:g} g awaiting your acceptance.',
            url='/dashboard/vendor?section=desk',
            data={'order_id': order.id},
        )
    except Exception:
        logger.exception('notify_new_order failed for order %s', getattr(order, 'id', None))


def notify_new_sell_order(sell_order):
    """Dealer tray alert when a customer requests a sell-back (vendor buys metal back)."""
    try:
        vendor = sell_order.buy_order.product.vendor
        grams = float(sell_order.qty_grams)
        create_and_send(
            vendor,
            category=Notification.ORDER_NEW,
            title='New sell-back request',
            body=f'{grams:g} g sell-back awaiting your acceptance.',
            url='/dashboard/vendor?section=sellback',
            data={'sell_order_id': sell_order.id},
        )
    except Exception:
        logger.exception(
            'notify_new_sell_order failed for sell_order %s', getattr(sell_order, 'id', None),
        )


def notify_order_status(order: Order, event: str):
    """Customer alert for accept / reject / paid (and similar buy-order events)."""
    try:
        customer = order.customer
        metal = (order.product.metal or 'metal').title()
        grams = float(order.qty_grams)
        event = (event or '').lower()
        if event == 'accepted':
            title = 'Order accepted — pay now'
            body = f'Your {metal} order ({grams:g} g) was accepted. Complete payment to finish.'
            url = f'/payment/{order.id}'
        elif event == 'rejected':
            title = 'Order declined'
            body = f'Your {metal} order ({grams:g} g) was declined by the dealer.'
            url = '/dashboard/customer?section=orders'
        elif event == 'paid':
            title = 'Payment confirmed'
            body = f'Your {metal} purchase ({grams:g} g) is confirmed and in your portfolio.'
            url = '/dashboard/customer?section=portfolio'
        else:
            title = 'Order update'
            body = f'Your {metal} order ({grams:g} g) status: {event}.'
            url = '/dashboard/customer?section=orders'
        create_and_send(
            customer,
            category=Notification.ORDER_STATUS,
            title=title,
            body=body,
            url=url,
            data={'order_id': order.id, 'event': event},
        )
    except Exception:
        logger.exception('notify_order_status failed for order %s', getattr(order, 'id', None))


def notify_sell_order_status(sell_order, event: str):
    """Portfolio / sell-back notifications for the customer."""
    try:
        customer = sell_order.customer
        grams = float(sell_order.qty_grams)
        event = (event or '').lower()
        if event in ('accepted', 'vendor_accepted'):
            title = 'Sell request accepted'
            body = f'Your sell-back of {grams:g} g was accepted and is being processed.'
        elif event in ('completed',):
            title = 'Sell completed'
            body = f'Your sell-back of {grams:g} g is complete. Funds are on the way.'
        elif event in ('rejected',):
            title = 'Sell request declined'
            body = f'Your sell-back of {grams:g} g was declined.'
        elif event in ('admin_approved', 'approved'):
            title = 'Sell payout confirmed'
            body = f'Admin confirmed funds for your {grams:g} g sell-back.'
        else:
            title = 'Sell update'
            body = f'Your sell-back ({grams:g} g) status: {event}.'
        create_and_send(
            customer,
            category=Notification.PORTFOLIO,
            title=title,
            body=body,
            url='/dashboard/customer?section=orders',
            data={'sell_order_id': sell_order.id, 'event': event},
        )
    except Exception:
        logger.exception(
            'notify_sell_order_status failed for sell_order %s',
            getattr(sell_order, 'id', None),
        )


def notify_redemption_requested(redemption):
    """
    Alert the counterparty that a physical redemption OTP was opened.
    Customer-initiated → notify vendor. Vendor-initiated → notify customer (to show OTP).
    """
    try:
        order = redemption.order
        units = int(redemption.qty_units)
        product_name = order.product.name if order.product_id else 'product'
        if redemption.requested_by == redemption.BY_CUSTOMER:
            vendor = order.product.vendor
            create_and_send(
                vendor,
                category=Notification.ORDER_NEW,
                title='Redemption OTP ready',
                body=(
                    f'Customer requested physical redemption of {units} unit(s) '
                    f'of {product_name}. Enter the OTP from their dashboard to complete.'
                ),
                url='/dashboard/vendor?section=redemptions',
                data={'redemption_id': redemption.id, 'order_id': order.id},
            )
        else:
            create_and_send(
                redemption.customer,
                category=Notification.PORTFOLIO,
                title='Vendor requested redemption',
                body=(
                    f'Your dealer requested physical redemption of {units} unit(s) '
                    f'of {product_name}. Share the OTP from your portfolio with them in person.'
                ),
                url='/dashboard/customer?section=portfolio',
                data={'redemption_id': redemption.id, 'order_id': order.id},
            )
    except Exception:
        logger.exception(
            'notify_redemption_requested failed for redemption %s',
            getattr(redemption, 'id', None),
        )


def notify_redemption_completed(redemption):
    """Notify the customer that physical redemption was verified."""
    try:
        units = int(redemption.qty_units)
        product_name = (
            redemption.order.product.name if redemption.order_id and redemption.order.product_id
            else 'product'
        )
        create_and_send(
            redemption.customer,
            category=Notification.PORTFOLIO,
            title='Redemption completed',
            body=(
                f'{units} unit(s) of {product_name} were redeemed physically. '
                f'They remain in your holdings for P&L tracking and can no longer be sold online.'
            ),
            url='/dashboard/customer?section=portfolio',
            data={'redemption_id': redemption.id, 'order_id': redemption.order_id},
        )
        vendor = redemption.order.product.vendor
        create_and_send(
            vendor,
            category=Notification.ORDER_STATUS,
            title='Redemption verified',
            body=f'Redemption of {units} unit(s) of {product_name} is complete.',
            url='/dashboard/vendor?section=redemptions',
            data={'redemption_id': redemption.id, 'order_id': redemption.order_id},
        )
    except Exception:
        logger.exception(
            'notify_redemption_completed failed for redemption %s',
            getattr(redemption, 'id', None),
        )


def broadcast_price_alert(metal: str, old_price: float, new_price: float, pct: float):
    """
    Notify everyone interested in a significant per-gram spot move: customers who
    hold that metal, plus *any* signed-in user (customer, vendor, or admin) who has
    an active push subscription — subscribing is an explicit opt-in, so role
    shouldn't gate delivery. Previously this only ever reached customer accounts,
    which silently excluded vendors/admins even though their subscriptions worked
    fine for every other notification category.
    """
    metal = (metal or 'gold').lower()
    direction = 'up' if new_price >= old_price else 'down'
    sign = '+' if pct >= 0 else ''
    title = f'{metal.title()} price {direction}'
    body = (
        f'{metal.title()} moved {sign}{pct:.2f}% to AED {new_price:.2f}/g '
        f'(was AED {old_price:.2f}/g).'
    )

    holder_ids = set(
        Order.objects.filter(
            status=Order.PAID,
            product__metal=metal,
        )
        .values_list('customer_id', flat=True)
        .distinct()
    )
    # Anyone signed in with an active push subscription opted in explicitly —
    # notify them regardless of account type (customer/vendor/admin).
    sub_user_ids = set(
        PushSubscription.objects.filter(
            is_active=True,
            user__isnull=False,
        ).values_list('user_id', flat=True)
    )
    target_ids = holder_ids | sub_user_ids
    if not target_ids:
        return 0

    users = User.objects.filter(id__in=target_ids, is_active=True)
    n = 0
    for u in users.iterator(chunk_size=200):
        create_and_send(
            u,
            category=Notification.PRICE_ALERT,
            title=title,
            body=body,
            url='/marketplace',
            data={
                'metal': metal,
                'old_price': old_price,
                'new_price': new_price,
                'pct': pct,
            },
        )
        n += 1

    # Visitors who enabled alerts without signing in still get price-movement pushes.
    n += _push_to_guest_subscribers(
        title,
        body,
        url='/marketplace',
        data={'metal': metal, 'old_price': old_price, 'new_price': new_price, 'pct': pct},
        category=Notification.PRICE_ALERT,
    )
    return n


def notify_customer_kyc_decision(user, approved: bool, reason: str = ''):
    """Global platform KYC decision (admin-approved identity, not per-vendor manual KYC)."""
    try:
        if approved:
            title = 'KYC verified'
            body = 'Your identity verification is approved. You can now trade on Cridora.'
        else:
            title = 'KYC needs attention'
            body = (
                f'Your KYC was not approved. {reason}'.strip()
                if reason
                else 'Your KYC was not approved. Please review and resubmit your documents.'
            )
        create_and_send(
            user,
            category=Notification.KYC_STATUS,
            title=title,
            body=body,
            url='/dashboard/customer?section=account',
            data={'approved': approved, 'reason': reason},
        )
    except Exception:
        logger.exception('notify_customer_kyc_decision failed for user %s', getattr(user, 'id', None))


def notify_vendor_kyb_decision(user, approved: bool, reason: str = ''):
    """Global platform KYB decision for a vendor account."""
    try:
        if approved:
            title = 'KYB approved'
            body = 'Your business verification is approved. Your live sales desk is now active.'
        else:
            title = 'KYB needs attention'
            body = (
                f'Your KYB was not approved. {reason}'.strip()
                if reason
                else 'Your KYB was not approved. Please review and resubmit your documents.'
            )
        create_and_send(
            user,
            category=Notification.KYB_STATUS,
            title=title,
            body=body,
            url='/dashboard/vendor?section=kyb',
            data={'approved': approved, 'reason': reason},
        )
    except Exception:
        logger.exception('notify_vendor_kyb_decision failed for user %s', getattr(user, 'id', None))


AUDIENCE_ALL = 'all'
AUDIENCE_CUSTOMER = 'customer'
AUDIENCE_VENDOR = 'vendor'
AUDIENCE_ADMIN = 'admin'
AUDIENCE_CHOICES = (AUDIENCE_ALL, AUDIENCE_CUSTOMER, AUDIENCE_VENDOR, AUDIENCE_ADMIN)

_AUDIENCE_USER_TYPE = {
    AUDIENCE_CUSTOMER: User.CUSTOMER,
    AUDIENCE_VENDOR: User.VENDOR,
    AUDIENCE_ADMIN: User.ADMIN,
}


def admin_broadcast_custom(
    admin_user,
    audience: str,
    title: str,
    body: str,
    url: str = '',
    include_guests: bool = False,
) -> dict:
    """
    Admin-authored custom message, targeted at a role (or everyone). Creates one in-app
    Notification per registered recipient (so it shows in their bell) plus a Web Push.
    Guests (not signed in) can only be reached when audience == 'all' since they have no role.
    """
    audience = (audience or AUDIENCE_ALL).strip().lower()
    if audience not in AUDIENCE_CHOICES:
        audience = AUDIENCE_ALL

    qs = User.objects.filter(is_active=True)
    user_type = _AUDIENCE_USER_TYPE.get(audience)
    if user_type is not None:
        qs = qs.filter(user_type=user_type)
    else:
        qs = qs.filter(user_type__in=(User.CUSTOMER, User.VENDOR, User.ADMIN))

    sent = 0
    for u in qs.iterator(chunk_size=200):
        create_and_send(
            u,
            category=Notification.ADMIN_BROADCAST,
            title=title,
            body=body,
            url=url or '/',
            data={'sent_by': getattr(admin_user, 'id', None)},
        )
        sent += 1

    guests_sent = 0
    if include_guests and audience == AUDIENCE_ALL:
        guests_sent = _push_to_guest_subscribers(
            title, body, url=url or '/', data={'admin_broadcast': True}, category=Notification.ADMIN_BROADCAST,
        )

    try:
        AdminBroadcastLog.objects.create(
            sent_by=admin_user,
            kind=AdminBroadcastLog.CUSTOM,
            audience=audience,
            title=title,
            body=body,
            url=url or '',
            recipients_count=sent,
            guests_count=guests_sent,
        )
    except Exception:
        logger.exception('Failed to write AdminBroadcastLog for custom message')

    return {'recipients': sent, 'guests': guests_sent, 'audience': audience}


def _spot_aed_per_gram(payload, metal: str):
    if not payload:
        return None
    block = payload.get(metal)
    if not isinstance(block, dict):
        return None
    if metal == 'gold':
        v = block.get('24K') or block.get('24k')
    elif metal == 'silver':
        v = block.get('999')
    else:
        v = next((x for x in block.values() if isinstance(x, (int, float))), None)
    if v is None:
        return None
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def get_live_metal_price(metal: str):
    """Current customer-facing (margined) AED/gram price, or None if the feed is unavailable."""
    from cridora.spot_prices import get_spot_payload_public_margined

    payload = get_spot_payload_public_margined()
    return _spot_aed_per_gram(payload, (metal or '').lower())


def broadcast_manual_price_update(metals, admin_user=None, include_guests: bool = True) -> dict:
    """
    Admin-triggered "send the current price right now" — one click, no threshold/cooldown
    gating (unlike the automatic `check_price_alerts` cron). Reaches any signed-in user
    (customer, vendor, or admin) with an active push subscription, plus, optionally,
    anonymous guest subscribers.
    """
    metals = [m.strip().lower() for m in (metals or []) if m and m.strip()]
    if not metals:
        metals = ['gold', 'silver']

    prices = {}
    for metal in metals:
        p = get_live_metal_price(metal)
        if p is not None:
            prices[metal] = p

    if not prices:
        return {'sent': 0, 'guests': 0, 'prices': {}, 'detail': 'Live price feed unavailable.'}

    if len(prices) == 1:
        metal, price = next(iter(prices.items()))
        title = f'{metal.title()} price update'
        body = f'{metal.title()} is now AED {price:.2f}/g.'
    else:
        title = 'Live metal prices'
        body = ' · '.join(f'{m.title()}: AED {p:.2f}/g' for m, p in prices.items())

    sub_user_ids = set(
        PushSubscription.objects.filter(
            is_active=True,
            user__isnull=False,
        ).values_list('user_id', flat=True)
    )
    sent = 0
    if sub_user_ids:
        users = User.objects.filter(id__in=sub_user_ids, is_active=True)
        for u in users.iterator(chunk_size=200):
            create_and_send(
                u,
                category=Notification.PRICE_ALERT,
                title=title,
                body=body,
                url='/marketplace',
                data={'prices': prices, 'manual': True, 'sent_by': getattr(admin_user, 'id', None)},
            )
            sent += 1

    guests_sent = 0
    if include_guests:
        guests_sent = _push_to_guest_subscribers(
            title, body, url='/marketplace', data={'prices': prices, 'manual': True},
            category=Notification.PRICE_ALERT,
        )

    try:
        AdminBroadcastLog.objects.create(
            sent_by=admin_user,
            kind=AdminBroadcastLog.LIVE_PRICE,
            audience='all',
            title=title,
            body=body,
            url='/marketplace',
            recipients_count=sent,
            guests_count=guests_sent,
        )
    except Exception:
        logger.exception('Failed to write AdminBroadcastLog for live price')

    return {'sent': sent, 'guests': guests_sent, 'prices': prices}


def notification_stats() -> dict:
    """Subscriber counts for the admin notification management panel."""
    active = PushSubscription.objects.filter(is_active=True)
    return {
        'customers': active.filter(user__user_type=User.CUSTOMER).count(),
        'vendors': active.filter(user__user_type=User.VENDOR).count(),
        'admins': active.filter(user__user_type=User.ADMIN).count(),
        'guests': active.filter(user__isnull=True).count(),
        'total': active.count(),
        'vapid_configured': vapid_configured(),
    }


def mark_read(user, notification_id) -> bool:
    updated = Notification.objects.filter(
        id=notification_id,
        recipient=user,
        read_at__isnull=True,
    ).update(read_at=timezone.now())
    return updated > 0


def mark_all_read(user) -> int:
    return Notification.objects.filter(
        recipient=user,
        read_at__isnull=True,
    ).update(read_at=timezone.now())


def price_alert_threshold_pct() -> float:
    """0 is a valid, intentional choice — it means "alert on any detected price
    change" (see `check_price_alerts`, which separately skips truly unchanged
    prices so a 0% threshold doesn't spam on a no-op tick)."""
    raw = getattr(settings, 'PRICE_ALERT_THRESHOLD_PCT', 1.0)
    try:
        return max(0.0, float(raw))
    except (TypeError, ValueError):
        return 1.0


def price_alert_cooldown_minutes() -> int:
    """0 is a valid, intentional choice — it means "no cooldown, alert every run"."""
    raw = getattr(settings, 'PRICE_ALERT_COOLDOWN_MINUTES', 30)
    try:
        return max(0, int(raw))
    except (TypeError, ValueError):
        return 30
