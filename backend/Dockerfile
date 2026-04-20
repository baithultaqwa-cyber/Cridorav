# Railway / Docker — set service Root Directory to `backend`
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Railway sets PORT; migrate on boot so Postgres is ready
CMD ["/bin/sh", "-c", "python manage.py migrate --noinput && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120"]
