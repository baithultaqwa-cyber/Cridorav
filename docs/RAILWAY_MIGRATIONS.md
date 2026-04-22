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

## Product images (`/media/`)

Marketplace `image_url` values must be absolute URLs the **browser** can open (same or different host than the Vite app). In production, set:

- **`DJANGO_PUBLIC_BASE_URL`** — public HTTPS base of the **API** (no trailing slash), e.g. `https://your-api.up.railway.app`  
  If the API’s public hostname is wrong in JSON, or media paths look like `http://127.0.0.1/...`, set this to the real API URL.

- **`USE_X_FORWARDED_HOST`** (default on in prod) is controlled by **`DJANGO_USE_X_FORWARDED_HOST`** so Django uses `X-Forwarded-Host` for `build_absolute_uri` when the proxy is in front of Gunicorn.

- **`DJANGO_MEDIA_ROOT` / volume** — catalog uploads must live on **persistent** storage; otherwise files disappear on redeploy and images 404.

---

*Last aligned with: Railway CLI 4.x, Django in `backend/`, April 2026.*
