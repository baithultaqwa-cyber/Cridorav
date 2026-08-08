"""
OTP → SMS facade. Swap the active provider in admin without changing OTP flow.

  Cridora → OTP service → SMS provider API → customer
"""
from __future__ import annotations

import logging

from django.conf import settings

from .models import SmsProviderConfig
from .providers import send_generic, send_httpsms, send_twilio

logger = logging.getLogger(__name__)


def _cfg():
    try:
        return SmsProviderConfig.get()
    except Exception:
        return None


def _resolved() -> dict:
    """Merge DB config with env fallbacks. Never includes secrets in logs."""
    row = _cfg()
    provider = (row.provider if row else '') or SmsProviderConfig.PROVIDER_HTTPSMS
    enabled = True if row is None else bool(row.enabled)
    api_url = (row.api_url if row else '') or ''
    api_key = (row.api_key if row else '') or ''
    api_secret = (row.api_secret if row else '') or ''
    from_number = (row.from_number if row else '') or ''
    auth_header = (row.auth_header if row else '') or 'x-api-key'
    body_template = (row.body_template if row else '') or ''
    extra_headers = (row.extra_headers if row else {}) or {}

    env_key = (getattr(settings, 'HTTPSMS_API_KEY', '') or '').strip()
    env_from = (getattr(settings, 'HTTPSMS_FROM_NUMBER', '') or '').strip()
    if provider == SmsProviderConfig.PROVIDER_HTTPSMS:
        api_key = api_key.strip() or env_key
        from_number = from_number.strip() or env_from

    return {
        'provider': provider,
        'enabled': enabled,
        'api_url': api_url.strip(),
        'api_key': api_key.strip(),
        'api_secret': api_secret.strip(),
        'from_number': from_number.strip(),
        'auth_header': auth_header.strip() or 'x-api-key',
        'body_template': body_template,
        'extra_headers': extra_headers if isinstance(extra_headers, dict) else {},
    }


def sms_configured() -> bool:
    r = _resolved()
    if not r['enabled']:
        return False
    if r['provider'] == SmsProviderConfig.PROVIDER_TWILIO:
        return bool(r['api_key'] and r['api_secret'] and r['from_number'])
    if r['provider'] == SmsProviderConfig.PROVIDER_GENERIC:
        return bool(r['api_url'] and r['api_key'])
    return bool(r['api_key'] and r['from_number'])


def send_sms(to_e164: str, content: str) -> bool:
    """Send via the active provider. Returns True if accepted (or DEBUG skip). Never logs body."""
    r = _resolved()
    if not r['enabled']:
        logger.warning('SMS gateway disabled by admin')
        return False
    if not sms_configured():
        if getattr(settings, 'DEBUG', False):
            logger.info('SMS skipped (provider not configured); dest ending %s', (to_e164 or '')[-4:])
            return True
        logger.warning('SMS provider not configured')
        return False

    provider = r['provider']
    try:
        if provider == SmsProviderConfig.PROVIDER_TWILIO:
            return send_twilio(
                account_sid=r['api_key'],
                auth_token=r['api_secret'],
                from_number=r['from_number'],
                to=to_e164,
                content=content,
                api_url=r['api_url'],
            )
        if provider == SmsProviderConfig.PROVIDER_GENERIC:
            return send_generic(
                api_url=r['api_url'],
                api_key=r['api_key'],
                from_number=r['from_number'],
                to=to_e164,
                content=content,
                auth_header=r['auth_header'],
                body_template=r['body_template'],
                extra_headers=r['extra_headers'],
            )
        return send_httpsms(
            api_key=r['api_key'],
            from_number=r['from_number'],
            to=to_e164,
            content=content,
            api_url=r['api_url'],
        )
    except Exception:
        logger.warning('SMS send failed for provider=%s', provider)
        return False


def public_status() -> dict:
    r = _resolved()
    key = r['api_key']
    secret = r['api_secret']
    return {
        'provider': r['provider'],
        'enabled': r['enabled'],
        'api_url': r['api_url'],
        'from_number': r['from_number'],
        'auth_header': r['auth_header'],
        'body_template': r['body_template'],
        'extra_headers': r['extra_headers'] if isinstance(r['extra_headers'], dict) else {},
        'api_key_configured': bool(key),
        'api_key_hint': f'••••{key[-4:]}' if len(key) >= 4 else ('••••' if key else ''),
        'api_secret_configured': bool(secret),
        'live': sms_configured(),
        'providers': [
            {'id': SmsProviderConfig.PROVIDER_HTTPSMS, 'label': 'httpSMS'},
            {'id': SmsProviderConfig.PROVIDER_TWILIO, 'label': 'Twilio'},
            {'id': SmsProviderConfig.PROVIDER_GENERIC, 'label': 'Custom HTTP API'},
        ],
    }
