"""Cache-backed login lockout (email + IP). Survives across gunicorn workers on same instance."""
from __future__ import annotations

import logging

from django.conf import settings
from django.core.cache import cache

from .client_ip import client_ip

logger = logging.getLogger(__name__)

GENERIC_LOGIN_ERROR = 'Invalid email or password.'
LOCKED_MESSAGE = 'Too many sign-in attempts. Please wait a few minutes and try again.'


def _threshold() -> int:
    try:
        return max(3, int(getattr(settings, 'LOGIN_LOCKOUT_ATTEMPTS', 8)))
    except (TypeError, ValueError):
        return 8


def _window() -> int:
    try:
        return max(60, int(getattr(settings, 'LOGIN_LOCKOUT_SECONDS', 900)))
    except (TypeError, ValueError):
        return 900


def _key(email: str, ip: str) -> str:
    return f'cridora:login-fail:{(email or "").lower().strip()}:{ip or "-"}'


def is_locked(email: str, request) -> bool:
    return bool(cache.get(_key(email, client_ip(request))))


def lockout_remaining(email: str, request) -> int:
    key = _key(email, client_ip(request))
    ttl = cache.ttl(key) if hasattr(cache, 'ttl') else None
    if ttl is None:
        return _window() if cache.get(key) else 0
    return max(0, int(ttl))


def record_failure(email: str, request) -> bool:
    """Increment fail count. Returns True if the account+IP is now locked."""
    ip = client_ip(request)
    count_key = _key(email, ip) + ':n'
    lock_key = _key(email, ip)
    try:
        n = cache.get(count_key) or 0
        n = int(n) + 1
        cache.set(count_key, n, timeout=_window())
        if n >= _threshold():
            cache.set(lock_key, 1, timeout=_window())
            logger.warning('Login lockout triggered ip_ending=%s', (ip or '')[-6:])
            return True
    except Exception:
        logger.warning('Login lockout cache unavailable')
    return False


def clear_failures(email: str, request) -> None:
    ip = client_ip(request)
    cache.delete(_key(email, ip))
    cache.delete(_key(email, ip) + ':n')
