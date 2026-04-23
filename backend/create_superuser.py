#!/usr/bin/env python
"""
Create (or update) the default admin superuser.

Ensures the admin account always has:
  - user_type = User.ADMIN
  - kyc_status = User.KYC_VERIFIED

Safe to run multiple times (idempotent).
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cridora.settings')
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402 — must come after django.setup()

User = get_user_model()

USERNAME = 'admin'
EMAIL = 'admin@example.com'
PASSWORD = 'admin123'

user, created = User.objects.get_or_create(
    email=EMAIL,
    defaults={'username': USERNAME},
)

if created:
    user.username = USERNAME
    user.set_password(PASSWORD)
    user.is_staff = True
    user.is_superuser = True
    print(f'[ok] Superuser created: {EMAIL}')
else:
    print(f'[ok] Superuser already exists: {EMAIL} — updating fields.')

user.user_type = User.ADMIN
user.kyc_status = User.KYC_VERIFIED
user.save()

print(f'[ok] user_type={user.user_type!r}, kyc_status={user.kyc_status!r}')
