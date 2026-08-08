"""Admin OTP monitor: status only — never expose code or hash."""
from __future__ import annotations

from django.db.models import Case, F, IntegerField, Q, When
from django.utils import timezone

from .models import OtpChallenge

STATUS_LIVE = 'live'
STATUS_VERIFIED = 'verified'
STATUS_EXPIRED = 'expired'
STATUS_LOCKED = 'locked'
STATUS_SEND_FAILED = 'send_failed'
STATUS_CHOICES = (STATUS_LIVE, STATUS_VERIFIED, STATUS_EXPIRED, STATUS_LOCKED, STATUS_SEND_FAILED)


def challenge_status(ch, now=None) -> str:
    now = now or timezone.now()
    if ch.outcome == 'verified':
        return STATUS_VERIFIED
    if ch.outcome == 'locked':
        return STATUS_LOCKED
    if ch.consumed_at:
        if ch.attempts >= ch.max_attempts:
            return STATUS_LOCKED
        return STATUS_VERIFIED
    if ch.sent_ok is False:
        return STATUS_SEND_FAILED
    if ch.expires_at <= now:
        return STATUS_EXPIRED
    return STATUS_LIVE


def serialize_challenge(ch, now=None) -> dict:
    now = now or timezone.now()
    status = challenge_status(ch, now)
    seconds_left = 0
    if status == STATUS_LIVE:
        seconds_left = max(0, int((ch.expires_at - now).total_seconds()))
    return {
        'id': ch.id,
        'channel': ch.channel,
        'purpose': ch.purpose,
        'destination': ch.destination,
        'attempts': ch.attempts,
        'max_attempts': ch.max_attempts,
        'status': status,
        'sent_ok': ch.sent_ok,
        'created_at': ch.created_at.isoformat() if ch.created_at else None,
        'expires_at': ch.expires_at.isoformat() if ch.expires_at else None,
        'consumed_at': ch.consumed_at.isoformat() if ch.consumed_at else None,
        'seconds_left': seconds_left,
    }


def _status_q(status: str, now):
    if status == STATUS_LIVE:
        return Q(consumed_at__isnull=True, expires_at__gt=now) & ~Q(sent_ok=False)
    if status == STATUS_VERIFIED:
        return Q(outcome='verified') | (
            Q(consumed_at__isnull=False) & ~Q(outcome='locked') & Q(attempts__lt=F('max_attempts'))
        )
    if status == STATUS_LOCKED:
        return Q(outcome='locked') | (
            Q(consumed_at__isnull=False) & Q(attempts__gte=F('max_attempts'))
        )
    if status == STATUS_EXPIRED:
        return Q(consumed_at__isnull=True, expires_at__lte=now) & ~Q(sent_ok=False)
    if status == STATUS_SEND_FAILED:
        return Q(sent_ok=False, consumed_at__isnull=True)
    return Q()


def list_otp_monitor(*, status='', channel='', purpose='', q='', limit=100) -> dict:
    now = timezone.now()
    qs = OtpChallenge.objects.all()
    if channel in (OtpChallenge.CHANNEL_SMS, OtpChallenge.CHANNEL_EMAIL):
        qs = qs.filter(channel=channel)
    if purpose in (OtpChallenge.PURPOSE_LOGIN, OtpChallenge.PURPOSE_PASSWORD_RESET):
        qs = qs.filter(purpose=purpose)
    needle = (q or '').strip()
    if needle:
        qs = qs.filter(destination__icontains=needle)

    counts = {
        STATUS_LIVE: qs.filter(_status_q(STATUS_LIVE, now)).count(),
        STATUS_VERIFIED: qs.filter(_status_q(STATUS_VERIFIED, now)).count(),
        STATUS_EXPIRED: qs.filter(_status_q(STATUS_EXPIRED, now)).count(),
        STATUS_LOCKED: qs.filter(_status_q(STATUS_LOCKED, now)).count(),
        STATUS_SEND_FAILED: qs.filter(_status_q(STATUS_SEND_FAILED, now)).count(),
    }
    counts['all'] = qs.count()

    if status in STATUS_CHOICES:
        qs = qs.filter(_status_q(status, now))

    qs = qs.annotate(
        _prio=Case(
            When(_status_q(STATUS_LIVE, now), then=0),
            When(_status_q(STATUS_SEND_FAILED, now), then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('_prio', '-created_at')

    try:
        cap = int(limit or 100)
    except (TypeError, ValueError):
        cap = 100
    cap = max(0, min(cap, 200))

    items = [serialize_challenge(ch, now) for ch in qs[:cap]] if cap else []
    gateway = {'provider': '', 'enabled': False, 'live': False}
    try:
        from messaging.sms import public_status
        g = public_status()
        gateway = {
            'provider': g.get('provider') or '',
            'enabled': bool(g.get('enabled')),
            'live': bool(g.get('live')),
        }
    except Exception:
        pass

    return {
        'gateway': gateway,
        'counts': counts,
        'live_count': counts[STATUS_LIVE],
        'items': items,
    }
