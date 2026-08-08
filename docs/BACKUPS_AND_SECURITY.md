# Cridora — data protection, backups, and API hardening

No system is “hack-proof.” This stack is defense-in-depth for financial data: authenticated APIs by default, throttling, login lockout, input validation on both sides, security headers, and automated database backups.

## What is already enforced

| Control | Where |
|---|---|
| JWT required on private APIs (`IsAuthenticated` default) | `settings.REST_FRAMEWORK` |
| Public allowlist only: login/register/OTP, marketplace/rates, webhooks, push subscribe, health | individual `AllowAny` views |
| Login lockout (email + IP, default 8 fails / 15 min) | `security.lockout` |
| Scoped + global rate limits (anon/user/burst + auth/OTP/upload) | `DEFAULT_THROTTLE_*` |
| Request size cap (512 KB JSON / 12 MB uploads) | `RequestSizeLimitMiddleware` |
| Security headers (nosniff, referrer, permissions, COOP, no-store on `/api/`) | `SecurityHeadersMiddleware` |
| Optional Django admin IP allowlist | `DJANGO_ADMIN_ALLOWED_IPS` |
| Generic login errors (no user enumeration) | `LoginSerializer` |
| Password validators + KYC/bank field checks | `security.validation` + serializers |
| KYC/payout files not served via public `/media/` | `secure_media.py` |
| HTTPS / secure cookies when `DJANGO_DEBUG=false` | `settings.py` |
| Stripe/Telr webhooks: signature + CSRF-exempt only those paths | `cridora/urls.py` |

## Auto backup

### 1. Railway Postgres (primary)

In Railway → Postgres plugin → **Backups**: enable daily snapshots. This is the restore source of truth for production. Document your RPO (e.g. 24h) and RTO (hours to restore a snapshot).

### 2. App dump (secondary, off-site)

Same Docker image, `RUN_MODE=backup_cron`:

```bash
python manage.py backup_cridora --loop
```

Or one-shot (Railway cron start command):

```bash
python manage.py backup_cridora
```

Creates `cridora-backup-*.gz` (+ `.sha256`), keeps last 14 locally (`BACKUP_DIR` or `backend/backups/`), and uploads to S3/R2 when a bucket is configured (`BACKUP_S3_BUCKET` or `CATALOG_MEDIA_S3_BUCKET`, prefix `BACKUP_S3_PREFIX` default `cridora-backups`). Objects use SSE-AES256.

`pg_dump` is used when `postgresql-client` is in the image (root `Dockerfile`). If dump fails, falls back to Django `dumpdata`.

### 3. Media / KYC

- Volume: Railway volume snapshots (separate from Postgres).
- S3/GDrive: rely on bucket versioning + provider backup; do not store KYC on public ACL.

## Env (API service)

```
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=...          # strong, unique
DJANGO_ALLOWED_HOSTS=your.domain
CORS_ALLOWED_ORIGINS=https://your.domain
CSRF_TRUSTED_ORIGINS=https://your.domain
DJANGO_HSTS_SECONDS=3600       # raise after HTTPS is stable
# DJANGO_ADMIN_ALLOWED_IPS=x.x.x.x
# LOGIN_LOCKOUT_ATTEMPTS=8
# LOGIN_LOCKOUT_SECONDS=900
# BACKUP_S3_BUCKET=
# BACKUP_S3_PREFIX=cridora-backups
# BACKUP_INTERVAL_HOURS=24
# BACKUP_DIR=/app/backups
```

Backup worker service: copy API image, set `RUN_MODE=backup_cron`, same `DATABASE_URL` + S3 credentials. No public HTTP needed.

## Restore (ops)

1. Create a new Postgres from Railway snapshot **or**
2. `pg_restore` the `.dump` inside the gunzipped custom dump (`gunzip -c cridora-backup-….gz > dump; pg_restore --clean --if-exists -d "$DATABASE_URL" dump`).
3. Remount volume / sync S3 media.
4. Rotate `DJANGO_SECRET_KEY` only if it leaked (invalidates JWTs).

## Form validation

Browser checks (email, UAE phone, OTP, password strength, IBAN, Emirates ID, KYC file type/size) live in `frontend/src/lib/formValidation.js`. The API re-validates the same rules — never trust the client.
