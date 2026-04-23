# Railway linking and Django migrations

Reference for working in the **Cridora v2** repo (this project folder) with [Railway](https://railway.app/) and running database migrations.

## Prerequisites

- [Railway CLI](https://docs.railway.com/guides/cli) installed (`railway --version`)
- Logged in: `railway login`
- The repo (or a parent directory) is **linked** to the Railway project

## Link the project (one time per machine / clone)

From the project root (where you run git / open the app):

```bash
cd path/to/Cridora-v2
railway link
```

Follow the prompts to select **project** and **environment** (e.g. production).  
Confirm with:

```bash
railway status
```

You should see something like: **Project**, **Environment**, and **Service** (e.g. the Django app service that runs the backend).

> **Service name** — Use the exact service that runs the Docker image with `manage.py` (often the API/backend service). Migrations must run in **that** environment so `DATABASE_URL` and app code match production.

## Where `manage.py` lives

Django is under **`backend/`** (WORKDIR in the image is typically `/app` with `manage.py` at the project root in the container).

- Local: `Cridora v2\backend\manage.py`
- In Railway SSH sessions, the running service usually has `WORKDIR` set so **`python manage.py …`** is correct from the app root (same as the Dockerfile `CMD`).

## Running migrations (recommended: SSH into the service)

`DATABASE_URL` on Railway often uses an **internal** hostname (e.g. `*.railway.internal`) that **does not resolve on your Windows/Mac machine**. So:

- `railway run python manage.py migrate` from your PC may fail with DNS / connection errors.
- Running the command **inside** the deployed container uses the same network as the database.

From the **linked** directory (any folder where `railway link` was run for this project):

```bash
railway ssh -s <SERVICE_NAME> -- python manage.py migrate --noinput
```

Replace `<SERVICE_NAME>` with the name shown in `railway status` (e.g. your backend service).

Examples:

```bash
railway ssh -s Cridorav -- python manage.py migrate --noinput
```

Other useful commands:

```bash
railway ssh -s <SERVICE_NAME> -- python manage.py showmigrations
```

```bash
railway ssh -s <SERVICE_NAME> -- python manage.py dbshell
```

## Migrations on deploy

The **Dockerfile** in `backend/` already runs migrations before Gunicorn starts, e.g.:

`python manage.py migrate --noinput && gunicorn …`

So new deploys usually apply migrations automatically. Use **SSH migration** when you need to run them **without** a full deploy or to verify / fix state.

## Optional: public database URL

If you intentionally use a **public** Postgres URL in a local `railway run` environment, `railway run python manage.py migrate` from your machine can work. That is a separate, manual setup; the default internal URL is why **SSH** is the reliable method above.

## Quick checklist

1. `railway status` — project and service look correct  
2. `railway ssh -s <SERVICE_NAME> -- python manage.py migrate --noinput`  
3. Re-check with `showmigrations` if needed  
4. Frontend: **`VITE_API_ORIGIN`** matches public API URL; backend: **`DJANGO_PUBLIC_BASE_URL`** set for media and absolute links  

## Frontend API origin (Vite build)

The browser calls the Django API using **`VITE_API_ORIGIN`** (see `frontend/src/config.js` and `frontend/.env.example`). On Railway, set this on the **frontend/static** service as a **build-time** variable so `API_AUTH_BASE` points at your public API, e.g.:

- `VITE_API_ORIGIN=https://your-api.up.railway.app` (no trailing slash; same host you use for `DJANGO_PUBLIC_BASE_URL` on the backend)

If this is wrong or missing, dashboards can show empty stats, catalog/pricing **404**, or **401** depending on where requests land. Redeploy the frontend after changing it.

## Troubleshooting: admin dashboard HTTP 500

If the admin UI shows **“Admin dashboard request failed (500)”** (or logs show `no such column` / missing column on `users_order`), the **production database has not applied all Django migrations** while the deployed code expects newer columns (e.g. `compliance_gates_at_payment` from `users/migrations/0023_...`).

**Fix:** run migrations on the **API** service (see [Running migrations](#running-migrations-recommended-ssh-into-the-service) above). After `migrate`, reload the admin dashboard.

> The UI may only start *showing* this error after the client displays API failures; the underlying issue is almost always **schema vs code**, not the Vite app.

## Product images (catalog)

Railway’s **container disk is ephemeral**. Catalog photos must use **object storage** or a **Railway volume**; otherwise each redeploy removes files on disk while Postgres still points at old paths (broken images).

### Option A — S3-compatible storage (recommended)

Catalog and staging images use **`django-storages`** when **`CATALOG_MEDIA_S3_BUCKET`** is set. Works with **AWS S3**, **Cloudflare R2**, MinIO, etc. No Railway volume UI required; safe across deploys and multiple instances.

Set on the **service that runs this Django image** (whatever Railway names it: e.g. web, API, backend):

| Variable | Required | Notes |
|----------|----------|--------|
| `CATALOG_MEDIA_S3_BUCKET` | Yes* | Bucket name |
| `CATALOG_MEDIA_S3_ACCESS_KEY_ID` | Yes* | Or `AWS_ACCESS_KEY_ID` |
| `CATALOG_MEDIA_S3_SECRET_ACCESS_KEY` | Yes* | Or `AWS_SECRET_ACCESS_KEY` |
| `CATALOG_MEDIA_S3_ENDPOINT_URL` | For R2 / non-AWS | e.g. `https://<accountid>.r2.cloudflarestorage.com` |
| `CATALOG_MEDIA_S3_REGION` | Often | AWS: e.g. `us-east-1`; R2: often `auto` |
| `CATALOG_MEDIA_S3_PUBLIC_DOMAIN` | Optional | Public hostname or R2 dev URL for browser-facing URLs (no trailing slash) |
| `CATALOG_MEDIA_S3_ADDRESSING_STYLE` | Optional | Default `path` when `ENDPOINT_URL` is set (typical for R2) |

\*If `CATALOG_MEDIA_S3_BUCKET` is set, credentials must be set or Django will fail at startup (`ImproperlyConfigured`).

Configure the bucket for **public read** on uploaded objects (or use a public bucket + `CATALOG_MEDIA_S3_PUBLIC_DOMAIN`). KYC documents stay on **filesystem** under `MEDIA_ROOT`, not in this bucket.

After enabling S3, new uploads get HTTPS URLs in API JSON. Existing rows that pointed at `/media/...` on the old disk must be **re-uploaded** or copied into the bucket under the same keys (`catalog_images/...`).

### Option B — Railway volume

Volumes attach to a **service**, not to a product named “Django”. Per [Using volumes](https://docs.railway.com/guides/volumes): open the **Command Palette** (`⌘K`) or the project canvas menu → create a volume → choose the **same service that runs your deploy** (the container with `gunicorn` / this repo’s Dockerfile). Set the mount path to **`/app/media`** so it matches `MEDIA_ROOT` inside the image (`/app` is the app root on Railway). Railway sets **`RAILWAY_VOLUME_MOUNT_PATH`**; this project uses it when **`DJANGO_MEDIA_ROOT`** is unset.

**Limits (see [Volumes reference](https://docs.railway.com/reference/volumes)):** e.g. one volume per service, **replicas cannot be used with a volume**, brief downtime on some redeploys when a volume is attached.

### URLs in the browser

- **`DJANGO_PUBLIC_BASE_URL`** — public HTTPS base of the **API** (no trailing slash).  
- Frontend: **`VITE_API_ORIGIN`** — same host as the API for `/media/...` resolution where still used (`frontend/src/utils/mediaUrl.js`). S3 catalog URLs are absolute and load directly.

---

*Last aligned with: Railway CLI 4.x, [Railway volumes docs](https://docs.railway.com/guides/volumes), Django in `backend/`, April 2026.*
