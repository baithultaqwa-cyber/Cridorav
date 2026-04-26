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

DEBUG = os.environ.get('DJANGO_DEBUG', 'true').lower() in ('1', 'true', 'yes')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-dev-only-set-django-secret-key-in-production'
    else:
        raise RuntimeError(
            'DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false. '
            'See backend/.env.example.'
        )

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get(
        'DJANGO_ALLOWED_HOSTS',
        'localhost,127.0.0.1',
    ).split(',')
    if h.strip()
]

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
    # Scopes are used with ScopedRateThrottle on specific APIViews only (not global throttling).
    'DEFAULT_THROTTLE_RATES': {
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
    },
}

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

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

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
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

AUTH_USER_MODEL = 'users.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

_logger = logging.getLogger(__name__)

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

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

# Default FileFields (KYC, payout proofs, EOD PDFs, repayments): same S3 bucket as catalog when
# CATALOG_MEDIA_S3_BUCKET is set, with signed URLs (querystring_auth). Catalog/vendor logos use
# get_catalog_media_storage (public). Without S3, everything uses local MEDIA_ROOT.
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}
if CATALOG_MEDIA_USE_S3:
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

if not DEBUG:
    USE_X_FORWARDED_HOST = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL_REDIRECT', 'true').lower() in ('1', 'true', 'yes')
    SESSION_COOKIE_SECURE = os.environ.get('DJANGO_SESSION_COOKIE_SECURE', 'true').lower() in ('1', 'true', 'yes')
    CSRF_COOKIE_SECURE = os.environ.get('DJANGO_CSRF_COOKIE_SECURE', 'true').lower() in ('1', 'true', 'yes')
