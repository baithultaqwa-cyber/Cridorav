"""Request hardening: security headers, body size, optional Django-admin IP allowlist."""
from __future__ import annotations

import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse

from .client_ip import client_ip

logger = logging.getLogger(__name__)

_JSON_MAX = 512 * 1024
_MULTIPART_MAX = 12 * 1024 * 1024
_UPLOAD_PREFIXES = (
    '/api/auth/documents/upload/',
    '/api/auth/vendor/catalog/staging-image/',
    '/api/auth/vendor/logo/',
    '/api/auth/admin/bank-payouts/',
    '/api/auth/payouts/proof/',
    '/api/auth/repayments/proof/',
    '/api/auth/vendor/repayments/',
    '/api/payments/',
)


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        response.headers.setdefault(
            'Permissions-Policy',
            'geolocation=(), microphone=(), camera=(), payment=()',
        )
        response.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        response.headers.setdefault('X-Permitted-Cross-Domain-Policies', 'none')
        if request.path.startswith('/api/'):
            response.headers.setdefault('Cache-Control', 'no-store')
            response.headers['X-Content-Type-Options'] = 'nosniff'
        return response


class RequestSizeLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            length = int(request.META.get('CONTENT_LENGTH') or 0)
        except (TypeError, ValueError):
            length = 0
        if length > 0:
            ctype = (request.META.get('CONTENT_TYPE') or '').lower()
            path = request.path or ''
            multipart = ctype.startswith('multipart/')
            upload = any(path.startswith(p) for p in _UPLOAD_PREFIXES)
            limit = _MULTIPART_MAX if (multipart or upload) else _JSON_MAX
            if length > limit:
                logger.warning('Rejected oversized request path=%s bytes=%s', path[:80], length)
                if path.startswith('/api/'):
                    return JsonResponse({'detail': 'Request is too large.'}, status=413)
                return HttpResponse('Request is too large.', status=413)
        return self.get_response(request)


class AdminIpAllowlistMiddleware:
    """Optional: DJANGO_ADMIN_ALLOWED_IPS=1.2.3.4,5.6.7.8 — empty means no extra lock."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ''
        if path.startswith('/monkey123/') or path == '/admin/' or path.startswith('/admin/'):
            allowed = getattr(settings, 'DJANGO_ADMIN_ALLOWED_IPS', ())
            if allowed:
                ip = client_ip(request)
                if ip not in allowed:
                    logger.warning('Django admin blocked ip_ending=%s', (ip or '')[-6:])
                    return HttpResponseForbidden('Admin access is restricted.')
        return self.get_response(request)
