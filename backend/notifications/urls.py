from django.urls import path

from .views import (
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    PushSubscribeView,
    PushUnsubscribeView,
    VapidPublicKeyView,
)

urlpatterns = [
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='notif-vapid-key'),
    path('subscribe/', PushSubscribeView.as_view(), name='notif-subscribe'),
    path('unsubscribe/', PushUnsubscribeView.as_view(), name='notif-unsubscribe'),
    path('', NotificationListView.as_view(), name='notif-list'),
    path('read-all/', NotificationReadAllView.as_view(), name='notif-read-all'),
    path('<int:notification_id>/read/', NotificationReadView.as_view(), name='notif-read'),
]
