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
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /frontend/dist ./frontend_dist

RUN python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["/bin/sh", "-c", "python manage.py migrate --noinput && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
