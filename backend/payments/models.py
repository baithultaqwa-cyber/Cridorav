"""
Provider-agnostic payment ledger (README v7 §10 / §12).
Workflows talk only to payments.service — never to Stripe/Telr/Aani directly.
"""
from django.conf import settings
from django.db import models


class PaymentTransaction(models.Model):
    FEE_GOLD_PRINCIPAL = 'gold_principal'
    FEE_DELIVERY = 'delivery_fee'
    FEE_SELLBACK_IN = 'sellback_funding_in'
    FEE_SELLBACK_OUT = 'sellback_disbursement_out'

    FEE_TYPE_CHOICES = [
        (FEE_GOLD_PRINCIPAL, 'Gold principal'),
        (FEE_DELIVERY, 'Delivery fee'),
        (FEE_SELLBACK_IN, 'Sell-back funding (vendor → Cridora)'),
        (FEE_SELLBACK_OUT, 'Sell-back disbursement (Cridora → customer)'),
    ]

    PROVIDER_MANUAL_AANI = 'manual_aani'
    PROVIDER_STRIPE = 'stripe'
    PROVIDER_TELR = 'telr'

    PROVIDER_CHOICES = [
        (PROVIDER_MANUAL_AANI, 'Manual Aani'),
        (PROVIDER_STRIPE, 'Stripe'),
        (PROVIDER_TELR, 'Telr'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_FAILED, 'Failed'),
    ]

    FUNDS_DEALER = 'dealer'
    FUNDS_CUSTOMER = 'customer'
    FUNDS_FEE = 'cridora_fee_revenue'

    FUNDS_CHOICES = [
        (FUNDS_DEALER, 'Dealer'),
        (FUNDS_CUSTOMER, 'Customer'),
        (FUNDS_FEE, 'Cridora fee revenue'),
    ]

    order = models.ForeignKey(
        'users.Order',
        on_delete=models.CASCADE,
        related_name='payment_transactions',
        null=True,
        blank=True,
    )
    sell_order = models.ForeignKey(
        'users.SellOrder',
        on_delete=models.CASCADE,
        related_name='payment_transactions',
        null=True,
        blank=True,
    )
    delivery_request = models.ForeignKey(
        'users.DeliveryRequest',
        on_delete=models.CASCADE,
        related_name='payment_transactions',
        null=True,
        blank=True,
    )
    fee_type = models.CharField(max_length=40, choices=FEE_TYPE_CHOICES)
    paired_transaction = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='paired_disbursements',
    )
    provider_key = models.CharField(max_length=32, choices=PROVIDER_CHOICES)
    provider_ref = models.CharField(max_length=255, blank=True, default='')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='AED')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    funds_source = models.CharField(max_length=32, choices=FUNDS_CHOICES, default=FUNDS_CUSTOMER)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_txns_initiated',
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payment_txns_confirmed',
    )
    evidence_ref = models.CharField(max_length=512, blank=True, default='')
    evidence_file = models.FileField(upload_to='payment_evidence/', null=True, blank=True)
    customer_proxy = models.CharField(max_length=64, blank=True, default='')  # Aani phone / email
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['provider_key', 'status']),
            models.Index(fields=['fee_type', 'status']),
        ]

    def __str__(self):
        return f'PTX-{self.id} [{self.provider_key}:{self.fee_type}:{self.status}]'
