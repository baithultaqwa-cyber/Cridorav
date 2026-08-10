from django.urls import path

from .views import (
    AdminNotificationStatsView,
    AdminSendLivePriceView,
    AdminSendNotificationView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    PushDeviceStatusView,
    PushSubscribeView,
    PushUnsubscribeView,
    VapidPublicKeyView,
)

urlpatterns = [
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='notif-vapid-key'),
    path('device-status/', PushDeviceStatusView.as_view(), name='notif-device-status'),
    path('subscribe/', PushSubscribeView.as_view(), name='notif-subscribe'),
    path('unsubscribe/', PushUnsubscribeView.as_view(), name='notif-unsubscribe'),
    path('admin/send/', AdminSendNotificationView.as_view(), name='notif-admin-send'),
    path('admin/send-live-price/', AdminSendLivePriceView.as_view(), name='notif-admin-send-live-price'),
    path('admin/stats/', AdminNotificationStatsView.as_view(), name='notif-admin-stats'),
    path('', NotificationListView.as_view(), name='notif-list'),
    path('read-all/', NotificationReadAllView.as_view(), name='notif-read-all'),
    path('<int:notification_id>/read/', NotificationReadView.as_view(), name='notif-read'),
]
