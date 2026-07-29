"""PaymentProvider interface — adapters implement this; workflows never import adapters."""
from abc import ABC, abstractmethod
from typing import Any, Optional


class PaymentProvider(ABC):
    key: str = ''

    @abstractmethod
    def is_configured(self) -> bool:
        ...

    @abstractmethod
    def initiate_collection(self, txn, *, customer_proxy: str = '', **kwargs) -> Any:
        """Start collecting money (Aani request / Checkout session / etc.)."""
        ...

    @abstractmethod
    def confirm_collection(self, txn, *, evidence: str = '', confirmed_by=None, **kwargs) -> Any:
        """Mark collection confirmed (manual evidence or webhook already verified)."""
        ...

    def initiate_payout(self, txn, **kwargs) -> Any:
        raise NotImplementedError(f'{self.key} does not support payouts yet')

    def confirm_payout(self, txn, *, evidence: str = '', confirmed_by=None, **kwargs) -> Any:
        raise NotImplementedError(f'{self.key} does not support payouts yet')
