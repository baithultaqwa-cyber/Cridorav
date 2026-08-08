"""Sync Cridora admin from Railway env. Runs on deploy; never logs the password."""
from __future__ import annotations

import logging
import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from security.validation import email_error, password_error, strip_text

User = get_user_model()
logger = logging.getLogger(__name__)

ENV_ID = ("CRIDORA_ADMIN_USER_ID", "DJANGO_BOOTSTRAP_ADMIN_USER_ID")
ENV_EMAIL = ("CRIDORA_ADMIN_EMAIL", "DJANGO_BOOTSTRAP_ADMIN_EMAIL")
ENV_USERNAME = ("CRIDORA_ADMIN_USERNAME", "DJANGO_BOOTSTRAP_ADMIN_USERNAME")
ENV_PASSWORD = ("CRIDORA_ADMIN_PASSWORD", "DJANGO_BOOTSTRAP_ADMIN_PASSWORD")


def _env(names) -> str:
    for name in names:
        v = os.environ.get(name)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return ""


def _blacklist_refresh_tokens(user) -> None:
    try:
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        logger.warning("Could not blacklist refresh tokens after admin password change")


class Command(BaseCommand):
    help = (
        "Create or update the Cridora admin from Railway variables: "
        "CRIDORA_ADMIN_USER_ID (optional), CRIDORA_ADMIN_EMAIL, "
        "CRIDORA_ADMIN_USERNAME (optional), CRIDORA_ADMIN_PASSWORD. "
        "DJANGO_BOOTSTRAP_ADMIN_* aliases still work. Applied automatically on web deploy."
    )

    def handle(self, *args, **options):
        raw_id = _env(ENV_ID)
        email = _env(ENV_EMAIL).lower()
        username = _env(ENV_USERNAME)
        password = os.environ.get("CRIDORA_ADMIN_PASSWORD") or os.environ.get("DJANGO_BOOTSTRAP_ADMIN_PASSWORD") or ""
        password = password if isinstance(password, str) else ""

        if not raw_id and not email and not username and not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping bootstrap_admin: set CRIDORA_ADMIN_EMAIL + CRIDORA_ADMIN_PASSWORD "
                    "(optional CRIDORA_ADMIN_USER_ID / CRIDORA_ADMIN_USERNAME) on Railway."
                )
            )
            return

        user_id = None
        if raw_id:
            try:
                user_id = int(raw_id)
            except ValueError as exc:
                raise CommandError("CRIDORA_ADMIN_USER_ID must be an integer.") from exc

        if email:
            err = email_error(email)
            if err:
                raise CommandError(err)
        if username:
            username = strip_text(username, 150)
            if not username:
                raise CommandError("CRIDORA_ADMIN_USERNAME is empty.")

        user = None
        if user_id is not None:
            user = User.objects.filter(pk=user_id).first()
            if user is None:
                raise CommandError(f"No user with id={user_id}.")
        elif email:
            user = User.objects.filter(email__iexact=email).first()
        elif username:
            user = User.objects.filter(username=username).first()

        creating = user is None
        if creating:
            if not email or not password:
                raise CommandError(
                    "To create an admin, set CRIDORA_ADMIN_EMAIL and CRIDORA_ADMIN_PASSWORD "
                    "(optional CRIDORA_ADMIN_USERNAME)."
                )
            un = username or (email.split("@")[0].replace(".", "_")[:150] or "admin")
            n = 0
            candidate = un
            while User.objects.filter(username=candidate).exists():
                n += 1
                suffix = f"_{n}"
                candidate = (un[: 150 - len(suffix)] + suffix) if len(un) + len(suffix) > 150 else un + suffix
            user = User(username=candidate, email=email)
            self.stdout.write(self.style.NOTICE(f"Creating admin id=new email={email}"))
        else:
            self.stdout.write(self.style.NOTICE(f"Updating admin id={user.id} email={user.email or email}"))

        if email and user.email.lower() != email:
            clash = User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
            if clash:
                raise CommandError(f"Email {email} is already used by another account.")
            user.email = email

        if username and user.username != username:
            clash = User.objects.filter(username=username).exclude(pk=user.pk).exists()
            if clash:
                raise CommandError(f"Username {username} is already used by another account.")
            user.username = username

        if password:
            err = password_error(password, user=user)
            if err:
                raise CommandError(err)
            user.set_password(password)

        user.user_type = User.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.kyc_status = User.KYC_VERIFIED
        user.save()

        if password and not creating:
            _blacklist_refresh_tokens(user)

        self.stdout.write(
            self.style.SUCCESS(
                f"Admin ready id={user.id} username={user.username} email={user.email}. "
                "Sign in on the site; Django admin: /monkey123/"
            )
        )
