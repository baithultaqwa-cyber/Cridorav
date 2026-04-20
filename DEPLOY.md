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

1. Open [railway.app](https://railway.app) and sign in (GitHub login is easiest).
2. **New project** → **Deploy from GitHub repo** → choose **Cridorav**.
3. Add a **PostgreSQL** database: **New** → **Database** → **PostgreSQL**. Railway injects `DATABASE_URL` into linked services.
4. Open your **web service** (the one that builds from the repo):
   - **Settings → Root Directory** → set to **`backend`**.
   - **Settings → Build** → leave default (Nixpacks) or set **Build Command** to:  
     `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - **Settings → Deploy** → **Start Command**:  
     `gunicorn cridora.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`  
     (Or rely on `backend/Procfile` if Railway detects it.)
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
2. **Root Directory** → **`frontend`**.
3. **Build Command:** `npm ci && npm run build`
4. **Start Command:** `npx --yes serve@14 -s dist -l $PORT`
5. **Variables:**

| Variable | Value |
|----------|--------|
| `VITE_API_ORIGIN` | `https://your-api.up.railway.app` (no trailing slash) |

6. Deploy. Open the generated **frontend URL** in the browser.

---

## 4. Quick checklist

- [ ] API responds: `GET https://your-api.../api/spot-prices/`
- [ ] Frontend loads and login works (CORS + `VITE_API_ORIGIN` correct)
- [ ] `DJANGO_DEBUG=false` in production
- [ ] Strong `DJANGO_SECRET_KEY` set

---

## Troubleshooting

- **502 / crash:** Check **Deploy logs**; often missing `DATABASE_URL` or migrate not run.
- **CORS errors:** `CORS_ALLOWED_ORIGINS` must include the exact frontend origin (`https://...`).
- **CSRF / admin:** Set `CSRF_TRUSTED_ORIGINS` to your API HTTPS origin.
