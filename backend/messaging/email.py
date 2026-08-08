"""Transactional email via Django SMTP (Zoho when EMAIL_HOST is set)."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def email_configured() -> bool:
    return bool(getattr(settings, 'EMAIL_HOST', None))


def send_otp_email(to_email: str, code: str) -> bool:
    """Send a one-time code. Does not include the code in logs."""
    try:
        send_mail(
            subject='Your Cridora verification code',
            message=(
                'Your Cridora verification code is listed below.\n\n'
                f'{code}\n\n'
                'It expires in 10 minutes. If you did not request this, you can ignore this message.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.warning('Failed to send OTP email')
        return False
