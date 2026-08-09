import logging
import os
from pathlib import Path
from datetime import timedelta

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

# Vite production build copied here (see repo-root Dockerfile); optional for backend-only deploys.
FRONTEND_DIST_DIR = BASE_DIR / 'frontend_dist'

MEDIA_URL = '/media/'
# Local MEDIA_ROOT when S3 is off. With CATALOG_MEDIA_S3_BUCKET, catalog/logo use public S3;
# KYC, payout proofs, EOD PDFs use private S3 via STORAGES['default'] (see below).
# Order: DJANGO_MEDIA_ROOT → RAILWAY_VOLUME_MOUNT_PATH (set when a volume is attached) → local media/
_media_root = os.environ.get('DJANGO_MEDIA_ROOT', '').strip()
_railway_vol = os.environ.get('RAILWAY_VOLUME_MOUNT_PATH', '').strip()
if _media_root:
    MEDIA_ROOT = Path(_media_root)
elif _railway_vol:
    MEDIA_ROOT = Path(_railway_vol)
else:
    MEDIA_ROOT = BASE_DIR / 'media'

# Secure by default: DEBUG is OFF unless DJANGO_DEBUG is explicitly truthy. This prevents a
# production deploy that forgets to set DJANGO_DEBUG from silently running with debug pages,
# verbose tracebacks, and secret disclosure. Local dev must set DJANGO_DEBUG=true (see .env.example).
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() in ('1', 'true', 'yes')

_INSECURE_DEV_SECRET_KEY = 'django-insecure-dev-only-set-django-secret-key-in-production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = _INSECURE_DEV_SECRET_KEY
    else:
        raise RuntimeError(
            'DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false. '
            'Generate one with: python -c "from django.core.management.utils import '
            'get_random_secret_key as g; print(g())". See backend/.env.example.'
        )
# Never allow the throwaway dev key to run a production process, even if someone sets it explicitly.
if not DEBUG and SECRET_KEY == _INSECURE_DEV_SECRET_KEY:
    raise RuntimeError(
        'DJANGO_SECRET_KEY is set to the insecure dev placeholder while DJANGO_DEBUG is false. '
        'Set a real, unique secret key in production.'
    )

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        'DJANGO_ALLOWED_HOSTS',
        'localhost,127.0.0.1',
    ).split(',')
    if h.strip()
]
# Railway healthchecks originate from this host (see docs.railway.com/deployments/healthchecks).
if 'healthcheck.railway.app' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('healthcheck.railway.app')

_csrf = os.environ.get('CSRF_TRUSTED_ORIGINS', '').strip()
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf.split(',') if o.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'users',
    'otp',
    'messaging',
    'vendor_kyc',
    'notifications',
    'payments',
    'security',
]

_cors = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174',
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors.split(',') if o.strip()]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'security.throttles.BurstRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'EXCEPTION_HANDLER': 'security.exception_handler.cridora_exception_handler',
    # Scopes are used with ScopedRateThrottle on specific APIViews (in addition to defaults
    # unless the view replaces throttle_classes entirely).
    'DEFAULT_THROTTLE_RATES': {
        'anon': '90/minute',
        'user': '240/minute',
        'burst': '40/second',
        'auth_login': '20/minute',
        'auth_register': '20/hour',
        'auth_vendor_apply': '10/hour',
        'auth_forgot_password': '10/hour',
        'auth_password_reset_confirm': '30/hour',
        'auth_change_password': '30/hour',
        'kyc_document_upload': '30/hour',
        'token_refresh': '30/minute',
        'stripe_checkout': '20/hour',
        'stripe_checkout_verify': '40/hour',
        'otp_send': '8/hour',
        'otp_verify': '30/hour',
        'push_subscribe': '40/hour',
    },
}

try:
    LOGIN_LOCKOUT_ATTEMPTS = max(3, int(os.environ.get('LOGIN_LOCKOUT_ATTEMPTS', '8')))
except ValueError:
    LOGIN_LOCKOUT_ATTEMPTS = 8
try:
    LOGIN_LOCKOUT_SECONDS = max(60, int(os.environ.get('LOGIN_LOCKOUT_SECONDS', '900')))
except ValueError:
    LOGIN_LOCKOUT_SECONDS = 900
_admin_ips = os.environ.get('DJANGO_ADMIN_ALLOWED_IPS', '').strip()
DJANGO_ADMIN_ALLOWED_IPS = tuple(p.strip() for p in _admin_ips.split(',') if p.strip())

DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 200

# Off by default. When enabled, the two demo accounts (customer@example.com,
# vendor@emiratesgold.com) get hardcoded showcase portfolio/catalog data on their dashboard
# instead of their real orders — only for marketing/screenshot deployments. Must stay off in
# production: a real customer or vendor signing up with either exact email would otherwise see
# fake data instead of their own, and `seed_users.py`'s test accounts use these same emails, so
# leaving this on also makes those accounts useless for real QA of the buy/sell flow.
CRIDORA_DEMO_MODE = os.environ.get('CRIDORA_DEMO_MODE', 'false').lower() in ('1', 'true', 'yes')

# Stripe: set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in production; webhook URL: /api/webhooks/stripe/
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '').strip()
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '').strip()
STRIPE_ALLOW_MANUAL_MARK_PAID = os.environ.get('STRIPE_ALLOW_MANUAL_MARK_PAID', 'false').lower() in (
    '1', 'true', 'yes',
)
# Optional; not required for server-created Checkout. Safe to expose to the browser.
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '').strip()
# Max time (seconds) to complete Stripe Checkout after session is created (default 5 minutes).
_stripe_dl = os.environ.get('STRIPE_CHECKOUT_DEADLINE_SECONDS', '300').strip()
try:
    STRIPE_CHECKOUT_DEADLINE_SECONDS = max(60, min(int(_stripe_dl), 3600))
except ValueError:
    STRIPE_CHECKOUT_DEADLINE_SECONDS = 300

# Payment providers (v7): Manual Aani + Stripe (kept) + Telr (optional)
MANUAL_AANI_ENABLED = os.environ.get('MANUAL_AANI_ENABLED', 'true').lower() in ('1', 'true', 'yes')
MANUAL_AANI_ALLOW_SINGLE_OPERATOR = os.environ.get('MANUAL_AANI_ALLOW_SINGLE_OPERATOR', 'false').lower() in (
    '1', 'true', 'yes',
)
PAYMENT_DEFAULT_PROVIDER = os.environ.get('PAYMENT_DEFAULT_PROVIDER', 'manual_aani').strip() or 'manual_aani'
TELR_ENABLED = os.environ.get('TELR_ENABLED', 'false').lower() in ('1', 'true', 'yes')
TELR_STORE_ID = os.environ.get('TELR_STORE_ID', '').strip()
TELR_AUTH_KEY = os.environ.get('TELR_AUTH_KEY', '').strip()
TELR_WEBHOOK_SECRET = os.environ.get('TELR_WEBHOOK_SECRET', '').strip()
TELR_CHECKOUT_BASE = os.environ.get('TELR_CHECKOUT_BASE', 'https://secure.telr.com/gateway/order.json').strip()
# Two-leg sell-back (v7 §5.4) — off until legal OK / ready to cut over
SELLBACK_TWO_LEG_ENABLED = os.environ.get('SELLBACK_TWO_LEG_ENABLED', 'false').lower() in ('1', 'true', 'yes')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'security.middleware.RequestSizeLimitMiddleware',
    'security.middleware.AdminIpAllowlistMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'security.middleware.SecurityHeadersMiddleware',
]

# Allow same-origin iframes (landing demos embed /demos/*.html under DemoShell).
X_FRAME_OPTIONS = 'SAMEORIGIN'

ROOT_URLCONF = 'cridora.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'cridora.wsgi.application'

# Set by Railway (reference Postgres → DATABASE_URL) or local .env — never commit credentials in this file.
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    _db_ssl_default = 'true' if not DEBUG else 'false'
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=os.environ.get('DATABASE_SSL_REQUIRE', _db_ssl_default).lower()
            in ('1', 'true', 'yes'),
        ),
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Argon2 first (modern default); PBKDF2 kept so existing hashes still verify and
# transparently upgrade on next successful login. Requires argon2-cffi in requirements.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

AUTH_USER_MODEL = 'users.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Lets Django admin (/monkey123/) log in with either username or email — same UX
# as the frontend login (which already looks users up by email).
AUTHENTICATION_BACKENDS = [
    'users.auth_backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
]

_logger = logging.getLogger(__name__)

# Shared cache is the foundation for lockout, DRF throttles, and spot-price caching
# across Gunicorn workers / Railway replicas. Set REDIS_URL on Railway (Redis plugin).
# Local/dev without Redis falls back to LocMem (per-process — fine for single-worker).
_REDIS_URL = (
    os.environ.get('REDIS_URL', '').strip()
    or os.environ.get('REDIS_PRIVATE_URL', '').strip()
)
if _REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _REDIS_URL,
            'KEY_PREFIX': 'cridora',
            'TIMEOUT': 300,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'cridora-locmem',
        }
    }
    if not DEBUG:
        _logger.warning(
            'REDIS_URL is unset — using LocMemCache. Login lockout and rate limits '
            'will NOT be shared across workers/replicas. Add a Redis service on Railway '
            'and set REDIS_URL before scaling beyond one process.'
        )

# Public browser URL: Stripe Checkout success/cancel, password reset links, etc.
# Prefer explicit FRONTEND_BASE_URL; else DJANGO_PUBLIC_BASE_URL (same as API when one host serves
# the SPA + API); else Railway’s public host. Without any of these, production would incorrectly
# use localhost for Stripe — see .env.example.
_fe = os.environ.get('FRONTEND_BASE_URL', '').strip()
_db_pub = os.environ.get('DJANGO_PUBLIC_BASE_URL', '').strip()
_rw_dom = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
if _fe:
    FRONTEND_BASE_URL = _fe.rstrip('/')
elif _db_pub:
    FRONTEND_BASE_URL = _db_pub.rstrip('/')
elif _rw_dom:
    d = _rw_dom.strip()
    d_low = d.lower()
    if d_low.startswith('https://') or d_low.startswith('http://'):
        FRONTEND_BASE_URL = d.rstrip('/')
    else:
        FRONTEND_BASE_URL = f'https://{d.rstrip("/")}'
else:
    FRONTEND_BASE_URL = 'http://localhost:5173'
    if not DEBUG:
        _logger.warning(
            'FRONTEND_BASE_URL / DJANGO_PUBLIC_BASE_URL / RAILWAY_PUBLIC_DOMAIN are unset. '
            'Using http://localhost:5173 — Stripe return URLs and email links will be wrong. '
            'Set FRONTEND_BASE_URL to your public app, e.g. https://yoursite.up.railway.app'
        )

# Optional: public origin of this Django app (e.g. https://api-production.up.railway.app).
# When set, catalog image_url in API JSON uses this instead of request.build_absolute_uri (fixes proxy Host).
PUBLIC_BASE_URL = os.environ.get('DJANGO_PUBLIC_BASE_URL', '').strip().rstrip('/')

# Catalog + staging images: S3-compatible object storage (AWS S3, Cloudflare R2, etc.).
# Recommended on Railway: no disk volume, survives redeploys, works with multiple instances.
# KYC FileFields keep using STORAGES["default"] (filesystem under MEDIA_ROOT).
_catalog_s3_bucket = os.environ.get('CATALOG_MEDIA_S3_BUCKET', '').strip()
_catalog_s3_key = (
    os.environ.get('CATALOG_MEDIA_S3_ACCESS_KEY_ID', '').strip()
    or os.environ.get('AWS_ACCESS_KEY_ID', '').strip()
)
_catalog_s3_secret = (
    os.environ.get('CATALOG_MEDIA_S3_SECRET_ACCESS_KEY', '').strip()
    or os.environ.get('AWS_SECRET_ACCESS_KEY', '').strip()
)
if _catalog_s3_bucket and (not _catalog_s3_key or not _catalog_s3_secret):
    raise ImproperlyConfigured(
        'CATALOG_MEDIA_S3_BUCKET is set but credentials are missing. Set '
        'CATALOG_MEDIA_S3_ACCESS_KEY_ID and CATALOG_MEDIA_S3_SECRET_ACCESS_KEY '
        '(or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY).'
    )

CATALOG_MEDIA_USE_S3 = bool(_catalog_s3_bucket)
CATALOG_MEDIA_S3_STORAGE_OPTIONS = {}
if CATALOG_MEDIA_USE_S3:
    _catalog_s3_endpoint = os.environ.get('CATALOG_MEDIA_S3_ENDPOINT_URL', '').strip()
    _catalog_s3_region = os.environ.get('CATALOG_MEDIA_S3_REGION', 'us-east-1').strip() or 'us-east-1'
    _catalog_s3_domain = os.environ.get('CATALOG_MEDIA_S3_PUBLIC_DOMAIN', '').strip().rstrip('/')
    _opts = {
        'bucket_name': _catalog_s3_bucket,
        'access_key': _catalog_s3_key,
        'secret_key': _catalog_s3_secret,
        'region_name': _catalog_s3_region,
        'file_overwrite': False,
        'querystring_auth': False,
        'default_acl': None,
        # Required for many S3-compatible endpoints (e.g. Cloudflare R2) and avoids silent upload failures.
        'signature_version': 's3v4',
    }
    if _catalog_s3_endpoint:
        _opts['endpoint_url'] = _catalog_s3_endpoint
        _style = os.environ.get('CATALOG_MEDIA_S3_ADDRESSING_STYLE', 'path').strip() or 'path'
        _opts['addressing_style'] = _style
    if _catalog_s3_domain:
        _opts['custom_domain'] = _catalog_s3_domain
    CATALOG_MEDIA_S3_STORAGE_OPTIONS = _opts

# Default FileFields (KYC, payout proofs, EOD PDFs, repayments): Google Drive when
# GOOGLE_DRIVE_REFRESH_TOKEN is set (see cridora/gdrive_storage.py), else same S3 bucket as
# catalog when CATALOG_MEDIA_S3_BUCKET is set (signed URLs via querystring_auth), else local
# MEDIA_ROOT (RAILWAY_VOLUME_MOUNT_PATH-backed volume when attached). Catalog/vendor logos
# always use get_catalog_media_storage (public S3) regardless of this.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}
GOOGLE_DRIVE_CLIENT_ID = os.environ.get('GOOGLE_DRIVE_CLIENT_ID', '').strip()
GOOGLE_DRIVE_CLIENT_SECRET = os.environ.get('GOOGLE_DRIVE_CLIENT_SECRET', '').strip()
GOOGLE_DRIVE_REFRESH_TOKEN = os.environ.get('GOOGLE_DRIVE_REFRESH_TOKEN', '').strip()
GOOGLE_DRIVE_ROOT_FOLDER_NAME = os.environ.get('GOOGLE_DRIVE_ROOT_FOLDER_NAME', '').strip() or 'Cridora-Documents'
GOOGLE_DRIVE_STORAGE_ENABLED = bool(
    GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN
)
if GOOGLE_DRIVE_STORAGE_ENABLED:
    STORAGES['default'] = {'BACKEND': 'cridora.gdrive_storage.GoogleDriveStorage'}
elif CATALOG_MEDIA_USE_S3:
    _priv = {
        'bucket_name': _catalog_s3_bucket,
        'access_key': _catalog_s3_key,
        'secret_key': _catalog_s3_secret,
        'region_name': _catalog_s3_region,
        'file_overwrite': False,
        'querystring_auth': True,
        'default_acl': None,
        'signature_version': 's3v4',
    }
    if _catalog_s3_endpoint:
        _priv['endpoint_url'] = _catalog_s3_endpoint
        _priv['addressing_style'] = (
            os.environ.get('CATALOG_MEDIA_S3_ADDRESSING_STYLE', 'path').strip() or 'path'
        )
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        'OPTIONS': _priv,
    }

# Optional SMTP for self-service “forgot password” email. If EMAIL_HOST is unset, mail goes to
# console in dev, and ForgotPasswordView falls back to the admin queue in production.
EMAIL_HOST = os.environ.get('EMAIL_HOST', '').strip() or None
if EMAIL_HOST:
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'true').lower() in ('1', 'true', 'yes')
    EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'false').lower() in ('1', 'true', 'yes')
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
    EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
else:
    EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@cridora.com')

# httpSMS (https://github.com/NdoleStudio/httpsms) — Android gateway for OTP SMS.
HTTPSMS_API_KEY = os.environ.get('HTTPSMS_API_KEY', '').strip()
HTTPSMS_FROM_NUMBER = os.environ.get('HTTPSMS_FROM_NUMBER', '').strip()

# Google Cloud Vision AML assist (server-side only; never called from the browser).
GOOGLE_VISION_API_KEY = os.environ.get('GOOGLE_VISION_API_KEY', '').strip()

# Web Push (VAPID). Generate once with:
#   python -c "from py_vapid import Vapid01; v=Vapid01(); v.generate_keys(); print(v.public_key); print(v.private_key)"
# or: npx web-push generate-vapid-keys
# Leave unset in local/dev — subscribe API still works for in-app notifications; push delivery is skipped.
# Accept both VAPID_* and WEB_PUSH_VAPID_* names (the latter is what's set on Railway) so a naming
# mismatch never silently disables push — see notifications/push_backend.py for the send-side key parsing.
VAPID_PUBLIC_KEY = (
    os.environ.get('VAPID_PUBLIC_KEY', '') or os.environ.get('WEB_PUSH_VAPID_PUBLIC_KEY', '')
).strip()
VAPID_PRIVATE_KEY = (
    os.environ.get('VAPID_PRIVATE_KEY', '') or os.environ.get('WEB_PUSH_VAPID_PRIVATE_KEY', '')
).strip()
VAPID_CLAIMS_EMAIL = (
    os.environ.get('VAPID_CLAIMS_EMAIL', '')
    or os.environ.get('WEB_PUSH_VAPID_CONTACT', '')
    or 'mailto:noreply@cridora.com'
).strip()

# Price movement alerts (management command: check_price_alerts)
try:
    PRICE_ALERT_THRESHOLD_PCT = float(os.environ.get('PRICE_ALERT_THRESHOLD_PCT', '1.0'))
except ValueError:
    PRICE_ALERT_THRESHOLD_PCT = 1.0
try:
    # Absolute AED/g move vs last reported rate (takes priority when > 0).
    PRICE_ALERT_THRESHOLD_AED = float(os.environ.get('PRICE_ALERT_THRESHOLD_AED', '5'))
except ValueError:
    PRICE_ALERT_THRESHOLD_AED = 5.0
try:
    # 0 = no cooldown — notify on every qualifying move.
    PRICE_ALERT_COOLDOWN_MINUTES = int(os.environ.get('PRICE_ALERT_COOLDOWN_MINUTES', '0'))
except ValueError:
    PRICE_ALERT_COOLDOWN_MINUTES = 0
try:
    # How often the watcher *checks* the feed. Pushes still only fire on real moves.
    PRICE_ALERT_LOOP_INTERVAL_SECONDS = int(os.environ.get('PRICE_ALERT_LOOP_INTERVAL_SECONDS', '30'))
except ValueError:
    PRICE_ALERT_LOOP_INTERVAL_SECONDS = 30

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    USE_X_FORWARDED_HOST = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', 'true').lower() in ('1', 'true', 'yes')
    # Railway healthchecks are plain HTTP to $PORT — must not 301 to HTTPS.
    SECURE_REDIRECT_EXEMPT = [r'^healthz/?$']
    SESSION_COOKIE_SECURE = os.environ.get('DJANGO_SESSION_COOKIE_SECURE', 'true').lower() in ('1', 'true', 'yes')
    CSRF_COOKIE_SECURE = os.environ.get('DJANGO_CSRF_COOKIE_SECURE', 'true').lower() in ('1', 'true', 'yes')
    # HSTS off by default (0) so a misconfigured deploy can't lock the domain into HTTPS-only
    # before DNS/TLS is verified. Set DJANGO_HSTS_SECONDS once HTTPS is confirmed stable — start
    # small (e.g. 3600) and raise it (e.g. 31536000 for a year) as confidence grows.
    SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0'))
    if SECURE_HSTS_SECONDS:
        SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('DJANGO_HSTS_INCLUDE_SUBDOMAINS', 'false').lower() in ('1', 'true', 'yes')
        SECURE_HSTS_PRELOAD = os.environ.get('DJANGO_HSTS_PRELOAD', 'false').lower() in ('1', 'true', 'yes')
