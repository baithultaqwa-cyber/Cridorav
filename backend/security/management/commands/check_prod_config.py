"""Fail-fast production configuration guard.

Run on web start (see repo-root Dockerfile) *before* Gunicorn boots. When DEBUG is off, this
refuses to start the server if any critical security setting is missing or unsafe, so a
misconfigured deploy fails loudly instead of silently running insecure. In DEBUG it is a no-op
so local development is never blocked.
"""
from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand

_INSECURE_DEV_SECRET_KEY = 'django-insecure-dev-only-set-django-secret-key-in-production'


class Command(BaseCommand):
    help = 'Validate critical production security settings; exit non-zero if unsafe (DEBUG only skips).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--strict',
            action='store_true',
            help='Treat warnings as hard failures too.',
        )

    def handle(self, *args, **options):
        if settings.DEBUG:
            self.stdout.write(self.style.WARNING('check_prod_config: DEBUG is on — skipping production checks.'))
            return

        errors: list[str] = []
        warnings: list[str] = []

        # --- Secret key ---
        key = (settings.SECRET_KEY or '').strip()
        if not key or key == _INSECURE_DEV_SECRET_KEY:
            errors.append('DJANGO_SECRET_KEY is missing or set to the insecure dev placeholder.')
        elif len(key) < 32:
            errors.append('DJANGO_SECRET_KEY is too short (use at least 50 random characters).')

        # --- Allowed hosts ---
        hosts = [h for h in getattr(settings, 'ALLOWED_HOSTS', []) if h not in ('healthcheck.railway.app',)]
        if '*' in getattr(settings, 'ALLOWED_HOSTS', []):
            errors.append("ALLOWED_HOSTS contains '*' — set DJANGO_ALLOWED_HOSTS to your real domain(s).")
        if not hosts or hosts == ['localhost', '127.0.0.1'] or set(hosts) <= {'localhost', '127.0.0.1'}:
            errors.append('DJANGO_ALLOWED_HOSTS is not set to a public domain (only localhost found).')

        # --- Transport security ---
        if not getattr(settings, 'SECURE_SSL_REDIRECT', False):
            warnings.append('SECURE_SSL_REDIRECT is off (set DJANGO_SECURE_SSL_REDIRECT=true behind HTTPS).')
        if not getattr(settings, 'SESSION_COOKIE_SECURE', False):
            warnings.append('SESSION_COOKIE_SECURE is off.')
        if not getattr(settings, 'CSRF_COOKIE_SECURE', False):
            warnings.append('CSRF_COOKIE_SECURE is off.')
        if not getattr(settings, 'SECURE_HSTS_SECONDS', 0):
            warnings.append('HSTS is disabled (set DJANGO_HSTS_SECONDS once HTTPS is stable).')

        # --- CSRF trusted origins (needed for the admin/session forms over HTTPS) ---
        if not getattr(settings, 'CSRF_TRUSTED_ORIGINS', []):
            warnings.append('CSRF_TRUSTED_ORIGINS is empty — set it to your https origin(s).')

        # --- Payment webhook secrets (only when the provider is enabled) ---
        if getattr(settings, 'TELR_ENABLED', False) and not getattr(settings, 'TELR_WEBHOOK_SECRET', '').strip():
            errors.append('TELR_ENABLED is true but TELR_WEBHOOK_SECRET is missing — webhooks would be unverifiable.')
        if getattr(settings, 'STRIPE_SECRET_KEY', '').strip() and not getattr(settings, 'STRIPE_WEBHOOK_SECRET', '').strip():
            errors.append('STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing.')

        # --- Demo/manual-override footguns that must be off in production ---
        if getattr(settings, 'CRIDORA_DEMO_MODE', False):
            errors.append('CRIDORA_DEMO_MODE is on in production — real accounts would see fake data.')
        if getattr(settings, 'STRIPE_ALLOW_MANUAL_MARK_PAID', False):
            errors.append('STRIPE_ALLOW_MANUAL_MARK_PAID is on in production — orders could be marked paid without payment.')

        # --- Shared cache (lockout / throttles / scale) ---
        cache_backend = (settings.CACHES.get('default') or {}).get('BACKEND', '')
        if 'locmem' in cache_backend.lower():
            warnings.append(
                'REDIS_URL is unset — LocMemCache is per-process. Add Redis before scaling workers/replicas.'
            )

        for w in warnings:
            self.stdout.write(self.style.WARNING(f'  [warn] {w}'))
        for e in errors:
            self.stdout.write(self.style.ERROR(f'  [FAIL] {e}'))

        hard = list(errors)
        if options.get('strict'):
            hard += warnings

        if hard:
            # Non-zero exit stops the deploy before Gunicorn starts.
            raise SystemExit(
                f'check_prod_config: {len(hard)} blocking issue(s) found. Fix the env vars above and redeploy.'
            )

        self.stdout.write(self.style.SUCCESS('check_prod_config: production security settings OK.'))
