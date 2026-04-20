"""
Create a Django superuser from environment variables.

Reads:
  DJANGO_SUPERUSER_USERNAME  (default: admin)
  DJANGO_SUPERUSER_EMAIL     (default: admin@example.com)
  DJANGO_SUPERUSER_PASSWORD  (required — skips creation if not set)

Idempotent: does nothing if the user already exists.
Run this after `python manage.py migrate`.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cridora.settings')
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402 — must come after setup()

User = get_user_model()

username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', '')

if not password:
    print('DJANGO_SUPERUSER_PASSWORD not set — skipping superuser creation.')
else:
    if User.objects.filter(username=username).exists():
        print(f'Superuser "{username}" already exists — skipping.')
    else:
        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            user_type='admin',
        )
        print(f'Superuser "{username}" created successfully.')
