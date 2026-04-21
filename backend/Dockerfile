# =========================
# FRONTEND BUILD
# =========================
FROM node:20-alpine AS frontend

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# =========================
# BACKEND BUILD
# =========================
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 gcc \
    && rm -rf /var/lib/apt/lists/*

# ✅ FIRST copy requirements
COPY backend/requirements.txt .

# ✅ THEN install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ✅ THEN copy full backend
COPY backend/ .

# frontend build into Django
COPY --from=frontend /frontend/dist ./frontend_dist

# static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# start server
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:$PORT"]
