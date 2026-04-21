# =========================
# FRONTEND BUILD STAGE
# =========================
FROM node:20-alpine AS frontend

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# =========================
# BACKEND STAGE (DJANGO)
# =========================
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System deps (Postgres support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies FIRST (best caching behavior)
COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Bring frontend build into Django (if you serve it)
COPY --from=frontend /frontend/dist ./frontend_dist

# Static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Run migrations + start server
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120"]