# Deploy Cridora (GitHub + Railway)

Your empty GitHub repo: [baithultaqwa-cyber/Cridorav](https://github.com/baithultaqwa-cyber/Cridorav).

## 1. Push code to GitHub (local machine)

From the project root (`Cridora v2`):

```bash
git init
git add .
git commit -m "Initial commit: Cridora marketplace (Django + React)"
git branch -M main
git remote add origin https://github.com/baithultaqwa-cyber/Cridorav.git
git push -u origin main
```

If GitHub asks for a password, use a **Personal Access Token** (GitHub → Settings → Developer settings → Fine-grained or classic token) instead of your account password.

---

## 2. Railway — API (Django)

> **Monorepo:** You can deploy **API + React on one URL** (recommended if you want a single Railway hostname): **Root Directory** = **repo root** (leave empty or `.`), **Dockerfile** = root **`Dockerfile`**. That image builds the Vite app and serves it from Django (`frontend_dist`).
>
> Or deploy **API only** with **Root Directory** = **`backend`** (`backend/Dockerfile` — no UI in that image). For the **UI** on a second service, use **`frontend`** and `frontend/Dockerfile`.
>
> If **Root Directory is empty** (repo root) and no Dockerfile is set, Railway may try **Railpack** and fail. Set **Build → Dockerfile** to the root **`Dockerfile`** (or **`RAILWAY_DOCKERFILE_PATH=Dockerfile`**).

1. Open [railway.app](https://railway.app) and sign in (GitHub login is easiest).
2. **New project** → **Deploy from GitHub repo** → choose **Cridorav**.
3. Add a **PostgreSQL** database: **New** → **Database** → **PostgreSQL**. Railway injects `DATABASE_URL` into linked services.
4. Open your **web service** (the one that builds from the repo):
   - **Single service (API + website):** **Root Directory** = **repo root**; **Dockerfile path** = **`Dockerfile`** (not `backend/Dockerfile`).
   - **API only:** **Root Directory** = **`backend`**; **`backend/Dockerfile`**.
   - If Railway still tries **Railpack**, open **Build** and choose **Dockerfile**, or set **`RAILWAY_DOCKERFILE_PATH=Dockerfile`**.
   - **Do not** set a custom Build Command unless you know you need it — the image already runs `collectstatic` and starts **gunicorn** via `Dockerfile`.
5. **Variables** (service → **Variables**), add at minimum:

| Variable | Example |
|----------|---------|
| `DJANGO_SECRET_KEY` | Long random string (generate locally: `python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `your-api.up.railway.app` (comma-separated if multiple) |
| `CSRF_TRUSTED_ORIGINS` | `https://your-api.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | If the UI is a **separate** service: `https://your-frontend.up.railway.app`. If UI is **same** host as API (root Dockerfile): include `https://your-api.up.railway.app` (comma-separated) |

Link Postgres: **Variables** → **Add Reference** → select `DATABASE_URL` from the Postgres plugin.

**Cridora admin from Railway (applied on every web deploy):** set on the **Cridorav** service:

| Variable | Required | Purpose |
|----------|----------|---------|
| `CRIDORA_ADMIN_USER_ID` | optional | Existing user id to promote / update |
| `CRIDORA_ADMIN_EMAIL` | yes to create | Login email |
| `CRIDORA_ADMIN_USERNAME` | optional | Login username (Django admin) |
| `CRIDORA_ADMIN_PASSWORD` | yes to create / to rotate | Strong password |

Change any of these → **Redeploy**. `bootstrap_admin` runs after migrate. Old `DJANGO_BOOTSTRAP_ADMIN_*` names still work. Anyone with Railway access can become admin — same trust as `DATABASE_URL` / `DJANGO_SECRET_KEY`. After a rotation you may delete `CRIDORA_ADMIN_PASSWORD` from Variables; the hash stays in Postgres until you set a new password.

6. **Deploy** → wait for build. Then run migrations once:

   **Railway** → your API service → **Deployments** → open latest → **Shell**, or use **one-off command**:

   ```bash
   python manage.py migrate --noinput
   python manage.py createsuperuser
   ```

7. Copy the **public URL** of the API (e.g. `https://xxx.up.railway.app`). Your API base is:  
   `https://xxx.up.railway.app/api/auth`

**Media / uploads:** Files in `MEDIA_ROOT` on Railway are **ephemeral** (lost on redeploy). For production KYC images, plan **S3-compatible storage** or Railway **Volumes** later.

---

## 3. Railway — Frontend (React)

1. In the same Railway project, **New** → **GitHub Repo** → same **Cridorav** repo (second service).
2. **Root Directory** → **`frontend`** (required so `frontend/Dockerfile` is used).
3. Builder should use **`frontend/Dockerfile`** (Node build + `serve`). If Railpack fails, force **Dockerfile** in service settings.
5. **Variables (frontend service):**

| Variable | Value |
|----------|--------|
| **`CRIDORA_API_ORIGIN`** | **`https://your-api.up.railway.app`** (no trailing slash) — **recommended.** Written into `/config.runtime.js` **when the container starts** (no frontend rebuild needed when you change the API URL). |
| `API_PUBLIC_URL` | Same as above (alias; either variable works). |
| `VITE_API_ORIGIN` | Optional — same URL if you want it **baked into** the JS at `npm run build`. |

6. Deploy. Open the generated **frontend URL** in the browser.

**API CORS (required):** On the **Django** service, set **`CORS_ALLOWED_ORIGINS`** to your **exact** frontend origin, e.g. `https://cridorav-frontend-production.up.railway.app` (no path, no trailing slash). Redeploy the API after changing it.

**If the UI still calls the wrong host:** Open DevTools → Network → reload → check `/api/spot-prices/`. The request host must be your **API** service. Fix **`CRIDORA_API_ORIGIN`** on the **frontend** to match **API → Settings → public URL**, **restart** the frontend (no rebuild required). **`VITE_*` alone is not enough** if the image was built without it — use **`CRIDORA_API_ORIGIN`**.

---

## 4. Quick checklist

- [ ] API responds: `GET https://your-api.../api/spot-prices/`
- [ ] Frontend loads and login works (CORS + `VITE_API_ORIGIN` correct)
- [ ] `DJANGO_DEBUG=false` in production
- [ ] Strong `DJANGO_SECRET_KEY` set

---

## Troubleshooting

- **“Error creating build plan with Railpack”:** The service **Root Directory** is not set (Railway is building from the repo root). Set **Root Directory** to **`backend`** for the API or **`frontend`** for the UI, then redeploy. With a **`Dockerfile`** in that folder, Railway should use Docker instead of Railpack.
- **502 / crash:** Check **Deploy logs**; often missing `DATABASE_URL` or migrate not run.
- **“Application failed to respond” (Railway):** Open **API service → Deployments → Logs**. Common causes: (1) **`DJANGO_SECRET_KEY`** unset while **`DJANGO_DEBUG=false`** — process exits on boot. (2) **Postgres SSL** — set **`DATABASE_SSL_REQUIRE=true`** on the API if the DB requires TLS. (3) **OOM** — try **`WEB_CONCURRENCY=1`** (default in Dockerfile) or upgrade plan. (4) **`DJANGO_ALLOWED_HOSTS`** must include your API hostname. Confirm the app responds: **`GET https://your-api/healthz/`** should return **`ok`**.
- **CORS errors:** `CORS_ALLOWED_ORIGINS` must include the exact frontend origin (`https://...`).
- **Spot price ticker / CORS / wrong API host:** Confirm the **API** public URL in Railway (open `https://…/api/spot-prices/` — should return JSON). Set **`CORS_ALLOWED_ORIGINS`** on the API to `https://cridorav-frontend-production.up.railway.app` (your real frontend URL). If the API hostname is not `*-production.up.railway.app` matching the frontend name, set **`VITE_API_ORIGIN`** on the frontend to the API URL and redeploy.
- **CSRF / admin:** Set `CSRF_TRUSTED_ORIGINS` to your API HTTPS origin.

### Django admin URL (API service only)

- The **React** URL (frontend) **never** serves Django admin. Open the **Django / API** public URL from Railway.
- Try: **`https://<API-host>/healthz/`** → must show **`ok`**. If not, the API is down — fix deploy logs / `DJANGO_SECRET_KEY` / Postgres first.
- Django admin: **`https://<API-host>/monkey123/`** or **`/admin/`** (redirects to `monkey123`).
- **`DJANGO_ALLOWED_HOSTS`** must include **only** the API hostname (e.g. `cridorav-production.up.railway.app`), not the frontend hostname.
- Create a user: **API → Shell** → `python manage.py bootstrap_admin` (after setting `DJANGO_BOOTSTRAP_ADMIN_*` variables) or `createsuperuser`.

---

## 4. Cloudflare — AI search/reference crawlers

After deploy, apply the dashboard checklist in [`docs/CLOUDFLARE_AI_CRAWLERS.md`](docs/CLOUDFLARE_AI_CRAWLERS.md):

- Allow **Search** and **Agent** crawlers; block **Training**
- Keep managed robots Content-Signal as `search=yes, ai-train=no, use=reference`
- Verify `https://cridora.com/llms.txt` and `https://cridora.com/openapi-public-v1.yaml` return real documents (not the SPA shell)

**Deploy outages / Cloudflare error page:** Railway volume deploys briefly take origin down. Hide Cloudflare’s 521 page — Always Online + Worker or Pro Error Pages. See [`docs/CLOUDFLARE_UPDATING.md`](docs/CLOUDFLARE_UPDATING.md).
