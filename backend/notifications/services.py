"""
Notification creation + Web Push delivery.

Entry points used by other apps (orders, vendor_kyc, price alerts).
Never raise into callers — swallow and log so trading flows stay safe.
"""
import logging

from django.conf import settings
from django.utils import timezone

from users.models import Order, User

from .models import Notification, PushSubscription
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


def broadcast_price_alert(metal: str, old_price: float, new_price: float, pct: float):
    """
    Notify customers about a significant per-gram spot move.
    Prefer holders of that metal; fall back to all customers with an active push sub.
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
    # Also include anyone with an active push subscription who is a customer
    # so general per-gram gold/silver alerts reach interested users.
    sub_user_ids = set(
        PushSubscription.objects.filter(
            is_active=True,
            user__user_type=User.CUSTOMER,
        ).values_list('user_id', flat=True)
    )
    target_ids = holder_ids | sub_user_ids
    if not target_ids:
        return 0

    users = User.objects.filter(id__in=target_ids, user_type=User.CUSTOMER, is_active=True)
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
    return n


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
    raw = getattr(settings, 'PRICE_ALERT_THRESHOLD_PCT', 1.0)
    try:
        return max(0.1, float(raw))
    except (TypeError, ValueError):
        return 1.0


def price_alert_cooldown_minutes() -> int:
    raw = getattr(settings, 'PRICE_ALERT_COOLDOWN_MINUTES', 30)
    try:
        return max(5, int(raw))
    except (TypeError, ValueError):
        return 30
