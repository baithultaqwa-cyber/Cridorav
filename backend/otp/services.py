"""OTP create/verify. Codes are HMAC-hashed; plaintext is never stored."""
from __future__ import annotations

import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone

from messaging.email import send_otp_email
from messaging.sms import send_sms, sms_configured
from .models import OtpChallenge

logger = logging.getLogger(__name__)

OTP_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
RESET_TOKEN_MAX_AGE = 600  # seconds
GENERIC_OTP_MESSAGE = 'If that contact is valid, a verification code has been sent.'


def hash_otp(code: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        code.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()


def codes_match(code: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(code), stored_hash)


def normalize_uae_phone(raw: str) -> str | None:
    """Return E.164 +971… or None if not a plausible UAE mobile."""
    digits = re.sub(r'\D', '', (raw or '').strip())
    if digits.startswith('00971'):
        digits = digits[4:]
    if digits.startswith('971'):
        rest = digits[3:]
    elif digits.startswith('0') and len(digits) == 10:
        rest = digits[1:]
    elif len(digits) == 9:
        rest = digits
    else:
        return None
    if not re.fullmatch(r'5\d{8}', rest):
        return None
    return f'+971{rest}'


def normalize_email(raw: str) -> str | None:
    value = (raw or '').strip().lower()
    if '@' not in value or '.' not in value.split('@')[-1]:
        return None
    if len(value) > 254:
        return None
    return value


def _active_challenge(channel: str, purpose: str, destination: str):
    now = timezone.now()
    return (
        OtpChallenge.objects.filter(
            channel=channel,
            purpose=purpose,
            destination=destination,
            consumed_at__isnull=True,
            expires_at__gt=now,
        )
        .order_by('-created_at')
        .first()
    )


def issue_otp(channel: str, purpose: str, destination: str) -> tuple[bool, dict]:
    """
    Create and send an OTP. Always returns a generic client payload.
    debug_code is included only when DEBUG and the channel is not live-configured.
    """
    now = timezone.now()
    existing = _active_challenge(channel, purpose, destination)
    if existing and existing.created_at > now - RESEND_COOLDOWN:
        wait = int((existing.created_at + RESEND_COOLDOWN - now).total_seconds())
        return False, {
            'detail': f'Please wait {max(wait, 1)} seconds before requesting another code.',
            'resend_after': max(wait, 1),
        }

    code = f'{secrets.randbelow(1_000_000):06d}'
    challenge = OtpChallenge.objects.create(
        channel=channel,
        purpose=purpose,
        destination=destination,
        code_hash=hash_otp(code),
        expires_at=now + OTP_TTL,
    )

    sent = False
    if channel == OtpChallenge.CHANNEL_SMS:
        sent = send_sms(destination, f'Your Cridora code is {code}. It expires in 10 minutes.')
    elif channel == OtpChallenge.CHANNEL_EMAIL:
        sent = send_otp_email(destination, code)

    challenge.sent_ok = bool(sent)
    challenge.save(update_fields=['sent_ok'])

    if not sent:
        logger.warning('OTP send failed for channel=%s', channel)
        return False, {'detail': 'Unable to send a verification code right now. Please try again shortly.'}

    payload = {
        'detail': GENERIC_OTP_MESSAGE,
        'ttl_seconds': int(OTP_TTL.total_seconds()),
        'resend_after': int(RESEND_COOLDOWN.total_seconds()),
    }
    sms_live = channel == OtpChallenge.CHANNEL_SMS and sms_configured()
    email_live = channel == OtpChallenge.CHANNEL_EMAIL and bool(getattr(settings, 'EMAIL_HOST', None))
    if settings.DEBUG and not (sms_live or email_live):
        payload['debug_code'] = code
    return True, payload


def verify_otp(channel: str, purpose: str, destination: str, code: str) -> tuple[bool, str]:
    challenge = _active_challenge(channel, purpose, destination)
    if not challenge:
        return False, 'Invalid or expired code. Request a new one.'
    if challenge.attempts >= challenge.max_attempts:
        challenge.consumed_at = timezone.now()
        challenge.outcome = 'locked'
        challenge.save(update_fields=['consumed_at', 'outcome'])
        return False, 'Too many attempts. Request a new code.'
    challenge.attempts += 1
    challenge.save(update_fields=['attempts'])
    digits = re.sub(r'\D', '', code or '')
    if len(digits) != 6 or not codes_match(digits, challenge.code_hash):
        return False, 'That code does not match. Please try again.'
    challenge.consumed_at = timezone.now()
    challenge.outcome = 'verified'
    challenge.save(update_fields=['consumed_at', 'outcome'])
    return True, ''


def make_password_reset_token(user_id: int) -> str:
    return signing.dumps({'uid': user_id, 'p': 'pwreset'}, salt='cridora-otp-reset')


def read_password_reset_token(token: str) -> int | None:
    try:
        data = signing.loads(token, salt='cridora-otp-reset', max_age=RESET_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    uid = data.get('uid')
    if not isinstance(uid, int):
        return None
    return uid
