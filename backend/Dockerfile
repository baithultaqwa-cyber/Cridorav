# Python base image
FROM python:3.12-slim-bookworm

# Set working directory inside container
WORKDIR /app

# Prevent Python from writing pyc files + better logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# System dependencies (PostgreSQL support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy only requirements first (better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy full backend code
COPY . .

# Ensure static directory exists + collect static files safely
RUN python manage.py collectstatic --noinput || true

# Railway exposes PORT dynamically
EXPOSE 8000

# Run migrations + start Gunicorn (production-safe)
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn cridora.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120"]