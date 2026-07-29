"""Manual Aani — founder generates Aani request; maker-checker confirm with evidence."""
from django.conf import settings
from django.utils import timezone

from payments.base import PaymentProvider
from payments.models import PaymentTransaction


class ManualAaniProvider(PaymentProvider):
    key = PaymentTransaction.PROVIDER_MANUAL_AANI

    def is_configured(self) -> bool:
        # Always available in ops phase unless explicitly disabled
        return getattr(settings, 'MANUAL_AANI_ENABLED', True)

    def initiate_collection(self, txn: PaymentTransaction, *, customer_proxy: str = '', **kwargs):
        txn.provider_key = self.key
        txn.customer_proxy = (customer_proxy or txn.customer_proxy or '')[:64]
        txn.status = PaymentTransaction.STATUS_PENDING
        if kwargs.get('initiated_by') is not None:
            txn.initiated_by = kwargs['initiated_by']
        txn.save()
        return {
            'transaction_id': txn.id,
            'provider': self.key,
            'amount': str(txn.amount),
            'customer_proxy': txn.customer_proxy,
            'instruction': 'Generate an Aani payment request for this amount to the customer proxy, then confirm with evidence.',
        }

    def confirm_collection(
        self,
        txn: PaymentTransaction,
        *,
        evidence: str = '',
        confirmed_by=None,
        allow_same_operator: bool = False,
        **kwargs,
    ):
        if txn.status == PaymentTransaction.STATUS_CONFIRMED:
            return txn
        if confirmed_by is None:
            raise ValueError('confirmed_by_required')
        if (
            txn.initiated_by_id
            and confirmed_by.id == txn.initiated_by_id
            and not allow_same_operator
            and not getattr(settings, 'MANUAL_AANI_ALLOW_SINGLE_OPERATOR', False)
        ):
            raise ValueError('maker_checker_violation')
        txn.status = PaymentTransaction.STATUS_CONFIRMED
        txn.confirmed_by = confirmed_by
        txn.confirmed_at = timezone.now()
        if evidence:
            txn.evidence_ref = evidence[:512]
        txn.save()
        return txn

    def initiate_payout(self, txn: PaymentTransaction, **kwargs):
        txn.provider_key = self.key
        txn.status = PaymentTransaction.STATUS_PENDING
        if kwargs.get('initiated_by') is not None:
            txn.initiated_by = kwargs['initiated_by']
        txn.save()
        return {
            'transaction_id': txn.id,
            'provider': self.key,
            'amount': str(txn.amount),
            'instruction': 'Send Aani/bank payout for this amount, then confirm with evidence.',
        }

    def confirm_payout(self, txn: PaymentTransaction, *, evidence: str = '', confirmed_by=None, **kwargs):
        return self.confirm_collection(
            txn,
            evidence=evidence,
            confirmed_by=confirmed_by,
            allow_same_operator=kwargs.get('allow_same_operator', False),
        )
