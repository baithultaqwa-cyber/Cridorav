"""Stripe adapter — delegates Checkout/webhook to existing users.payment_stripe helpers."""
from django.conf import settings

from payments.base import PaymentProvider
from payments.models import PaymentTransaction


class StripePaymentProvider(PaymentProvider):
    key = PaymentTransaction.PROVIDER_STRIPE

    def is_configured(self) -> bool:
        return bool(getattr(settings, 'STRIPE_SECRET_KEY', '').strip())

    def initiate_collection(self, txn: PaymentTransaction, *, customer_proxy: str = '', **kwargs):
        """
        Creates a Stripe Checkout Session for the linked order (gold_principal only).
        Returns checkout URL for the customer.
        """
        from users.payment_stripe import create_checkout_session_for_order

        if not txn.order_id:
            raise ValueError('order_required')
        order = txn.order
        result = create_checkout_session_for_order(order, request=kwargs.get('request'))
        txn.provider_key = self.key
        txn.provider_ref = (result.get('session_id') or '')[:255]
        txn.status = PaymentTransaction.STATUS_PENDING
        if kwargs.get('initiated_by') is not None:
            txn.initiated_by = kwargs['initiated_by']
        txn.meta = {**(txn.meta or {}), 'checkout_url': result.get('url')}
        txn.save()
        return {
            'transaction_id': txn.id,
            'provider': self.key,
            'checkout_url': result.get('url'),
            'session_id': result.get('session_id'),
        }

    def confirm_collection(self, txn: PaymentTransaction, *, evidence: str = '', confirmed_by=None, **kwargs):
        """Normally confirmed via webhook; allow system confirm when already paid."""
        from django.utils import timezone

        if txn.status == PaymentTransaction.STATUS_CONFIRMED:
            return txn
        txn.status = PaymentTransaction.STATUS_CONFIRMED
        txn.confirmed_at = timezone.now()
        if evidence:
            txn.evidence_ref = evidence[:512]
        txn.save(update_fields=['status', 'confirmed_at', 'evidence_ref'])
        return txn
