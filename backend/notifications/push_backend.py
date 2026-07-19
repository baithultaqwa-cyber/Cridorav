"""Thin Web Push sender using pywebpush + VAPID keys."""
import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def vapid_configured() -> bool:
    return bool(
        getattr(settings, 'VAPID_PUBLIC_KEY', '')
        and getattr(settings, 'VAPID_PRIVATE_KEY', '')
    )


def _vapid_private_key():
    """
    Build a py_vapid Vapid01 instance from VAPID_PRIVATE_KEY.

    Handles three real-world shapes of that env var:
      1. Raw base64url key (no PEM headers) — pywebpush's `Vapid.from_string` handles it.
      2. PEM with real newlines — parsed explicitly via `Vapid01.from_pem`.
      3. PEM pasted into a dashboard that collapsed newlines into literal `\\n` text
         (common on Railway/Heroku-style env var UIs) — normalized back to real
         newlines before parsing, otherwise `str.splitlines()` sees one giant line
         and `from_pem` silently produces an empty/invalid key.

    pywebpush's own `webpush(vapid_private_key=<str>)` only auto-detects PEM headers
    when the string is read from a *file* — a raw PEM string passed directly falls
    into `Vapid.from_string`, which naively strips only real `\\n` and base64-decodes
    the rest, corrupting `-----BEGIN...-----` PEM text. Parse explicitly here instead.
    """
    from py_vapid import Vapid01

    raw = (settings.VAPID_PRIVATE_KEY or '').strip()
    if '\\n' in raw and '\n' not in raw:
        raw = raw.replace('\\n', '\n')
    if '-----BEGIN' in raw:
        return Vapid01.from_pem(raw.encode('utf8'))
    return Vapid01.from_string(raw)


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
