"""Telr adapter — hosted checkout + webhook skeleton (feature-flagged until keys set)."""
import hashlib
import hmac
import logging

from django.conf import settings
from django.utils import timezone

from payments.base import PaymentProvider
from payments.models import PaymentTransaction

logger = logging.getLogger(__name__)


class TelrPaymentProvider(PaymentProvider):
    key = PaymentTransaction.PROVIDER_TELR

    def is_configured(self) -> bool:
        if not getattr(settings, 'TELR_ENABLED', False):
            return False
        return bool(getattr(settings, 'TELR_STORE_ID', '').strip()) and bool(
            getattr(settings, 'TELR_AUTH_KEY', '').strip()
        )

    def initiate_collection(self, txn: PaymentTransaction, *, customer_proxy: str = '', **kwargs):
        """
        Skeleton: records a pending Telr collection and returns a placeholder checkout URL
        built from TELR_CHECKOUT_BASE. Replace with real Telr Remote API when keys are live.
        """
        store = getattr(settings, 'TELR_STORE_ID', '')
        base = getattr(settings, 'TELR_CHECKOUT_BASE', 'https://secure.telr.com/gateway/order.json').rstrip('/')
        # Synthetic cart id for reconciliation until real Telr order id exists
        cart_id = f'CRIDORA-{txn.id}-{txn.order_id or 0}'
        txn.provider_key = self.key
        txn.provider_ref = cart_id[:255]
        txn.status = PaymentTransaction.STATUS_PENDING
        if kwargs.get('initiated_by') is not None:
            txn.initiated_by = kwargs['initiated_by']
        checkout_hint = f'{base}?store={store}&cart={cart_id}&amount={txn.amount}'
        txn.meta = {
            **(txn.meta or {}),
            'checkout_hint': checkout_hint,
            'note': 'Telr Remote API create-order not fully wired — enable TELR_ENABLED and complete API call.',
        }
        txn.save()
        return {
            'transaction_id': txn.id,
            'provider': self.key,
            'cart_id': cart_id,
            'checkout_url': checkout_hint,
            'amount': str(txn.amount),
            'configured': self.is_configured(),
        }

    def confirm_collection(self, txn: PaymentTransaction, *, evidence: str = '', confirmed_by=None, **kwargs):
        if txn.status == PaymentTransaction.STATUS_CONFIRMED:
            return txn
        txn.status = PaymentTransaction.STATUS_CONFIRMED
        txn.confirmed_at = timezone.now()
        if evidence:
            txn.evidence_ref = evidence[:512]
        txn.save(update_fields=['status', 'confirmed_at', 'evidence_ref'])
        return txn


def verify_telr_webhook_signature(payload: bytes, signature: str) -> bool:
    secret = getattr(settings, 'TELR_WEBHOOK_SECRET', '').strip()
    if not secret:
        return False
    digest = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, (signature or '').strip())
