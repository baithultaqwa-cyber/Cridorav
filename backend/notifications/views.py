from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, PushSubscription
from .push_backend import vapid_configured
from .services import mark_all_read, mark_read, notification_to_dict


class VapidPublicKeyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key = getattr(settings, 'VAPID_PUBLIC_KEY', '') or ''
        return Response({
            'publicKey': key,
            'configured': vapid_configured() and bool(key),
        })


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

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
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': request.user,
                'p256dh': p256dh,
                'auth': auth,
                'user_agent': ua,
                'is_active': True,
                'last_seen_at': timezone.now(),
            },
        )
        return Response(
            {'id': sub.id, 'created': created, 'active': sub.is_active},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PushUnsubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = (request.data.get('endpoint') or '').strip()
        if not endpoint:
            return Response({'detail': 'endpoint is required.'}, status=status.HTTP_400_BAD_REQUEST)
        updated = PushSubscription.objects.filter(
            user=request.user,
            endpoint=endpoint,
        ).update(is_active=False)
        return Response({'deactivated': updated})


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
