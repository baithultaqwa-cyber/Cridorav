from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from users.models import User

from .models import AdminBroadcastLog, Notification, PushSubscription
from .push_backend import vapid_configured
from .services import (
    admin_broadcast_custom,
    broadcast_manual_price_update,
    mark_all_read,
    mark_read,
    notification_stats,
    notification_to_dict,
    send_welcome_push_on_first_subscribe,
)


def _require_admin(request):
    if not request.user or not request.user.is_authenticated or request.user.user_type != User.ADMIN:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


class VapidPublicKeyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key = getattr(settings, 'VAPID_PUBLIC_KEY', '') or ''
        return Response({
            'publicKey': key,
            'configured': vapid_configured() and bool(key),
        })


class PushSubscribeView(APIView):
    """
    Anyone can subscribe, signed in or not (e.g. price alerts for site visitors).
    If already signed in, the subscription is attached to (or re-claimed for) their account
    so personal notifications (orders, KYC, etc.) start reaching the same browser/device.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'push_subscribe'

    def post(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        keys = request.data.get('keys') or {}
        p256dh = (keys.get('p256dh') or request.data.get('p256dh') or '').strip()
        auth = (keys.get('auth') or request.data.get('auth') or '').strip()
        if not endpoint or not p256dh or not auth:
            return Response(
                {'detail': 'endpoint, keys.p256dh, and keys.auth are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ua = (request.META.get('HTTP_USER_AGENT') or '')[:512]
        user = request.user if request.user and request.user.is_authenticated else None
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': user,
                'p256dh': p256dh,
                'auth': auth,
                'user_agent': ua,
                'is_active': True,
                'last_seen_at': timezone.now(),
            },
        )
        welcome_sent = False
        if created:
            try:
                welcome_sent = send_welcome_push_on_first_subscribe(sub)
            except Exception:
                # Never fail subscribe because the welcome push misfired.
                welcome_sent = False
        return Response(
            {
                'id': sub.id,
                'created': created,
                'active': sub.is_active,
                'welcome_sent': welcome_sent,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PushUnsubscribeView(APIView):
    """Endpoint value is the effective credential here (it's an unguessable per-device push URL),
    so this intentionally does not require login — anonymous subscribers can unsubscribe too."""
    permission_classes = [AllowAny]

    def post(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        if not endpoint:
            return Response({'detail': 'endpoint is required.'}, status=status.HTTP_400_BAD_REQUEST)
        updated = PushSubscription.objects.filter(endpoint=endpoint).update(is_active=False)
        return Response({'deactivated': updated})


class AdminSendNotificationView(APIView):
    """Admin: send a custom message to all users, or just customers / vendors / admins."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        title = (request.data.get('title') or '').strip()
        body = (request.data.get('body') or '').strip()
        url = (request.data.get('url') or '').strip()
        audience = (request.data.get('audience') or 'all').strip()
        include_guests = bool(request.data.get('include_guests'))
        if not title or not body:
            return Response({'detail': 'title and body are required.'}, status=status.HTTP_400_BAD_REQUEST)
        result = admin_broadcast_custom(
            request.user, audience, title, body, url=url, include_guests=include_guests,
        )
        return Response(result, status=status.HTTP_201_CREATED)


class AdminSendLivePriceView(APIView):
    """Admin: one-click broadcast of the current live gold/silver price."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_admin(request)
        if err:
            return err
        metals = request.data.get('metals') or ['gold', 'silver']
        if isinstance(metals, str):
            metals = [metals]
        include_guests = request.data.get('include_guests')
        include_guests = True if include_guests is None else bool(include_guests)
        result = broadcast_manual_price_update(metals, admin_user=request.user, include_guests=include_guests)
        if not result.get('prices'):
            return Response(result, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result, status=status.HTTP_201_CREATED)


class AdminNotificationStatsView(APIView):
    """Admin: subscriber counts + recent admin-sent broadcasts for the management panel."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_admin(request)
        if err:
            return err
        stats = notification_stats()
        recent = AdminBroadcastLog.objects.select_related('sent_by')[:15]
        log = [
            {
                'kind': r.kind,
                'audience': r.audience,
                'title': r.title,
                'body': r.body,
                'url': r.url,
                'recipients': r.recipients_count,
                'guests': r.guests_count,
                'sent_by': (r.sent_by.get_full_name() or r.sent_by.email) if r.sent_by else 'System',
                'created_at': r.created_at.isoformat() if r.created_at else None,
            }
            for r in recent
        ]
        return Response({'stats': stats, 'recent_broadcasts': log})


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            limit = min(100, max(1, int(request.query_params.get('limit', 30))))
        except (TypeError, ValueError):
            limit = 30
        unread_only = (request.query_params.get('unread') or '').lower() in ('1', 'true', 'yes')
        qs = Notification.objects.filter(recipient=request.user)
        if unread_only:
            qs = qs.filter(read_at__isnull=True)
        items = [notification_to_dict(n) for n in qs[:limit]]
        unread_count = Notification.objects.filter(
            recipient=request.user,
            read_at__isnull=True,
        ).count()
        has_push = PushSubscription.objects.filter(
            user=request.user,
            is_active=True,
        ).exists()
        return Response({
            'items': items,
            'unread_count': unread_count,
            'push_enabled': has_push,
            'vapid_configured': vapid_configured(),
        })


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        ok = mark_read(request.user, notification_id)
        if not ok:
            # Already read or not found — still 200 if owned, else 404
            exists = Notification.objects.filter(
                id=notification_id,
                recipient=request.user,
            ).exists()
            if not exists:
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'ok': True})


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        n = mark_all_read(request.user)
        return Response({'marked': n})
