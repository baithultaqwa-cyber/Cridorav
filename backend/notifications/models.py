from django.conf import settings
from django.db import models


class PushSubscription(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
    )
    endpoint = models.URLField(max_length=512, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=512, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]

    def __str__(self):
        return f'PushSub user={self.user_id} active={self.is_active}'


class Notification(models.Model):
    ORDER_NEW = 'order_new'
    ORDER_STATUS = 'order_status'
    PRICE_ALERT = 'price_alert'
    PORTFOLIO = 'portfolio'
    VENDOR_KYC = 'vendor_kyc'
    KYC_STATUS = 'kyc_status'
    KYB_STATUS = 'kyb_status'
    CATEGORY_CHOICES = (
        (ORDER_NEW, 'New order'),
        (ORDER_STATUS, 'Order status'),
        (PRICE_ALERT, 'Price alert'),
        (PORTFOLIO, 'Portfolio'),
        (VENDOR_KYC, 'Vendor KYC'),
        (KYC_STATUS, 'Customer KYC'),
        (KYB_STATUS, 'Vendor KYB'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=200)
    body = models.TextField()
    url = models.CharField(max_length=500, blank=True, default='')
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    push_sent = models.BooleanField(default=False)
    push_error = models.CharField(max_length=500, blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'read_at']),
        ]

    def __str__(self):
        return f'{self.category}: {self.title[:40]}'


class PriceAlertState(models.Model):
    """Tracks last notified spot price per metal for movement alerts."""

    metal = models.CharField(max_length=20, unique=True)
    last_notified_price = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    last_notified_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'PriceAlertState({self.metal}={self.last_notified_price})'
