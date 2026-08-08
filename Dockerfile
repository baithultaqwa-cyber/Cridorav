# Monorepo root — Django API + React SPA (Railway: Root Directory = repo root, use this Dockerfile)
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /frontend/dist ./frontend_dist

RUN python manage.py collectstatic --noinput

EXPOSE 8000

# RUN_MODE=price_cron switches this same image into the self-looping price-alert
# worker (see backend/notifications/management/commands/run_price_alert_loop.py)
# instead of the web server. Kept in the shared image, gated by env var, because
# Railway's native cron/startCommand service settings weren't reliably applying
# to this particular service's deploys.
CMD ["/bin/sh", "-c", "if [ \"$RUN_MODE\" = \"price_cron\" ]; then exec python manage.py run_price_alert_loop; elif [ \"$RUN_MODE\" = \"backup_cron\" ]; then exec python manage.py backup_cridora --loop; else python manage.py migrate --noinput && python manage.py bootstrap_admin && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120; fi"]
