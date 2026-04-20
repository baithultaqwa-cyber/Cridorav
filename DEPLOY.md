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

> **Monorepo:** Prefer **Settings → Root Directory** = **`backend`** (API) or **`frontend`** (UI). That way each service uses `backend/Dockerfile` or `frontend/Dockerfile`.
>
> If **Root Directory is empty** (repo root), Railway runs **Railpack** on the whole repo and fails (“could not determine how to build”). This repo now includes **root `Dockerfile`** (API) and **`Dockerfile.frontend`** (UI). With repo root as context, set the **API** service to use **`Dockerfile`**, and the **frontend** service to **`Dockerfile.frontend`** (Build settings), or point Root Directory at **`backend`** / **`frontend`** as above.

1. Open [railway.app](https://railway.app) and sign in (GitHub login is easiest).
2. **New project** → **Deploy from GitHub repo** → choose **Cridorav**.
3. Add a **PostgreSQL** database: **New** → **Database** → **PostgreSQL**. Railway injects `DATABASE_URL` into linked services.
4. Open your **web service** (the one that builds from the repo):
   - **Settings → Root Directory** → set to **`backend`** (required).
   - **Settings → Build** → builder should pick up **`Dockerfile`** automatically.  
     If Railway still tries **Railpack**, open **Build** and choose **Dockerfile** / disable Railpack, or set variable **`RAILWAY_DOCKERFILE_PATH=Dockerfile`** for this service.
   - **Do not** set a custom Build Command unless you know you need it — the image already runs `collectstatic` and starts **gunicorn** via `Dockerfile`.
5. **Variables** (service → **Variables**), add at minimum:

| Variable | Example |
|----------|---------|
| `DJANGO_SECRET_KEY` | Long random string (generate locally: `python -c "import secrets; print(secrets.token_urlsafe(48))"`) |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `your-api.up.railway.app` (comma-separated if multiple) |
| `CSRF_TRUSTED_ORIGINS` | `https://your-api.up.railway.app` |
| `CORS_ALLOWED_ORIGINS` | `https://your-frontend.up.railway.app` (your React URL, comma-separated) |

Link Postgres: **Variables** → **Add Reference** → select `DATABASE_URL` from the Postgres plugin.

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
5. **Variables:**

| Variable | Value |
|----------|--------|
| `VITE_API_ORIGIN` | **`https://your-api.up.railway.app`** (no trailing slash). **Strongly recommended** — embeds the API URL at build time. If unset, the app **infers** the API from the frontend hostname when it matches `*-frontend-production.up.railway.app` → `https://*-production.up.railway.app` (e.g. `cridorav-frontend-production.…` → `https://cridorav-production.up.railway.app`). If your API uses a different public URL, you **must** set this variable and redeploy. |

6. Deploy. Open the generated **frontend URL** in the browser.

**API CORS (required):** On the **Django** service, set `CORS_ALLOWED_ORIGINS` to your **exact** frontend origin, e.g. `https://cridorav-frontend-production.up.railway.app` (no path, no trailing slash). Redeploy the API after changing it.

**If inference is wrong:** set `VITE_API_ORIGIN` to whatever Railway shows under the **API** service → **Settings → Networking / public URL**, redeploy the frontend, or set `window.__CRIDORA_API_ORIGIN__` in `frontend/index.html`.

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
- **CORS errors:** `CORS_ALLOWED_ORIGINS` must include the exact frontend origin (`https://...`).
- **Spot price ticker / CORS / wrong API host:** Confirm the **API** public URL in Railway (open `https://…/api/spot-prices/` — should return JSON). Set **`CORS_ALLOWED_ORIGINS`** on the API to `https://cridorav-frontend-production.up.railway.app` (your real frontend URL). If the API hostname is not `*-production.up.railway.app` matching the frontend name, set **`VITE_API_ORIGIN`** on the frontend to the API URL and redeploy.
- **CSRF / admin:** Set `CSRF_TRUSTED_ORIGINS` to your API HTTPS origin.
