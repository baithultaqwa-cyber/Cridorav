from django.conf import settings

from .base import PaymentProvider
from .models import PaymentTransaction


_PROVIDERS: dict[str, PaymentProvider] = {}


def register_provider(provider: PaymentProvider) -> None:
    _PROVIDERS[provider.key] = provider


def get_provider(key: str) -> PaymentProvider:
    ensure_providers_loaded()
    if key not in _PROVIDERS:
        raise KeyError(f'Unknown payment provider: {key}')
    return _PROVIDERS[key]


def list_enabled_providers() -> list[dict]:
    ensure_providers_loaded()
    out = []
    for key, p in _PROVIDERS.items():
        if not p.is_configured():
            continue
        out.append({
            'key': key,
            'label': {
                PaymentTransaction.PROVIDER_MANUAL_AANI: 'Aani (instant transfer)',
                PaymentTransaction.PROVIDER_STRIPE: 'Card (Stripe)',
                PaymentTransaction.PROVIDER_TELR: 'Card (Telr)',
            }.get(key, key),
        })
    return out


def ensure_providers_loaded() -> None:
    if _PROVIDERS:
        return
    from .adapters.manual_aani import ManualAaniProvider
    from .adapters.stripe_adapter import StripePaymentProvider
    from .adapters.telr import TelrPaymentProvider

    register_provider(ManualAaniProvider())
    register_provider(StripePaymentProvider())
    register_provider(TelrPaymentProvider())


def default_buy_provider_key() -> str:
    """Prefer manual Aani when enabled; else first configured provider."""
    ensure_providers_loaded()
    prefer = getattr(settings, 'PAYMENT_DEFAULT_PROVIDER', 'manual_aani')
    try:
        if get_provider(prefer).is_configured():
            return prefer
    except KeyError:
        pass
    for p in list_enabled_providers():
        return p['key']
    return PaymentTransaction.PROVIDER_MANUAL_AANI
