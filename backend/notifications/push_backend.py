"""Thin Web Push sender using pywebpush + VAPID keys."""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def normalize_vapid_private_key_env(raw: str) -> str:
    """Parse Railway/.env private key values (JSON-quoted PEM or raw PEM)."""
    value = (raw or '').strip()
    if not value:
        return ''
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, str):
                value = parsed
        except json.JSONDecodeError:
            value = value[1:-1]
    return value.replace('\\n', '\n').strip()


def _vapid_private_key():
    """
    Build a py_vapid Vapid01 instance from VAPID_PRIVATE_KEY.

    Handles real-world shapes of that env var (aligned with cridoraindia vapid_utils):
      1. Raw base64url key (no PEM headers) — `Vapid01.from_string`.
      2. PEM with real newlines — `Vapid01.from_pem`.
      3. PEM with literal `\\n` text (Railway/Heroku dashboards).
      4. JSON-quoted PEM / single-quoted env values.

    pywebpush's own `webpush(vapid_private_key=<str>)` only auto-detects PEM headers
    when the string is read from a *file* — a raw PEM string passed directly falls
    into `Vapid.from_string`, which corrupts PEM text. Parse explicitly here instead.
    """
    from py_vapid import Vapid01

    raw = normalize_vapid_private_key_env(getattr(settings, 'VAPID_PRIVATE_KEY', '') or '')
    if not raw:
        raise ValueError('empty VAPID private key')
    if '-----BEGIN' in raw:
        return Vapid01.from_pem(raw.encode('utf8'))
    return Vapid01.from_string(raw)


def vapid_signer_ready() -> bool:
    pub = (getattr(settings, 'VAPID_PUBLIC_KEY', '') or '').strip()
    if not pub:
        return False
    try:
        _vapid_private_key()
        return True
    except Exception as exc:
        logger.warning('VAPID private key could not be loaded: %s', exc)
        return False


def vapid_configured() -> bool:
    return bool(
        (getattr(settings, 'VAPID_PUBLIC_KEY', '') or '').strip()
        and (getattr(settings, 'VAPID_PRIVATE_KEY', '') or '').strip()
        and vapid_signer_ready()
    )


# pywebpush defaults ttl=0, which tells the push service "deliver right now or drop it" — no
# queueing/retry. Desktop Chrome keeps a near-permanent connection to the push service so this
# rarely bites there, but phones disconnect constantly (screen off, Doze, battery saver), so with
# ttl=0 the push service just discards the message if the device isn't reachable at that instant.
# A multi-hour TTL lets FCM/Mozilla's push service hold and retry delivery once the device wakes up.
DEFAULT_PUSH_TTL_SECONDS = 24 * 60 * 60


def send_web_push(subscription, payload: dict, ttl: int = DEFAULT_PUSH_TTL_SECONDS) -> tuple[bool, str]:
    """
    Send a push to one PushSubscription.
    Returns (ok, error_message). error_message may be 'gone' for 404/410.
    """
    if not vapid_configured():
        return False, 'vapid_not_configured'

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.warning('pywebpush is not installed; skipping push send.')
        return False, 'pywebpush_missing'

    subscription_info = {
        'endpoint': subscription.endpoint,
        'keys': {
            'p256dh': subscription.p256dh,
            'auth': subscription.auth,
        },
    }
    claims = {
        'sub': getattr(settings, 'VAPID_CLAIMS_EMAIL', 'mailto:noreply@cridora.com'),
    }
    try:
        vapid_key = _vapid_private_key()
    except Exception as e:
        logger.exception('Could not parse VAPID_PRIVATE_KEY')
        return False, f'bad_vapid_key: {e}'[:480]
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_key,
            vapid_claims=claims,
            ttl=ttl,
            # "high" nudges Android/FCM to wake the device and deliver promptly rather than
            # batching it with other low-priority traffic — matters most on mobile.
            headers={'Urgency': 'high'},
        )
        return True, ''
    except WebPushException as e:
        status_code = None
        if getattr(e, 'response', None) is not None:
            status_code = getattr(e.response, 'status_code', None)
        if status_code in (404, 410):
            return False, 'gone'
        logger.warning('WebPush failed for sub %s: %s', subscription.id, e)
        return False, str(e)[:480]
    except Exception as e:
        logger.exception('Unexpected push error for sub %s', subscription.id)
        return False, str(e)[:480]
