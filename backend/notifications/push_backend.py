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


def send_web_push(subscription, payload: dict) -> tuple[bool, str]:
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
        webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=claims,
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
