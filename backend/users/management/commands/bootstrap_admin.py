import os

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    """Create or update one Cridora admin user from environment variables (no secrets in git)."""

    help = (
        "Requires DJANGO_BOOTSTRAP_ADMIN_EMAIL and DJANGO_BOOTSTRAP_ADMIN_PASSWORD. "
        "Optional: DJANGO_BOOTSTRAP_ADMIN_USERNAME. Run on Railway: API service → Shell."
    )

    def handle(self, *args, **options):
        email = (os.environ.get("DJANGO_BOOTSTRAP_ADMIN_EMAIL") or "").strip()
        password = os.environ.get("DJANGO_BOOTSTRAP_ADMIN_PASSWORD") or ""
        if not email or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skipping bootstrap_admin: set DJANGO_BOOTSTRAP_ADMIN_EMAIL and "
                    "DJANGO_BOOTSTRAP_ADMIN_PASSWORD on the API service (Railway Variables)."
                )
            )
            return

        username = (os.environ.get("DJANGO_BOOTSTRAP_ADMIN_USERNAME") or "").strip()
        if not username:
            base = email.split("@")[0].replace(".", "_")
            username = base[:150] if base else "admin"

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            un = username
            n = 0
            while User.objects.filter(username=un).exists():
                n += 1
                suffix = f"_{n}"
                un = (username[: 150 - len(suffix)] + suffix) if len(username) + len(suffix) > 150 else username + suffix
            user = User(username=un, email=email)
            self.stdout.write(self.style.NOTICE(f"Creating admin: {email}"))
        else:
            self.stdout.write(self.style.NOTICE(f"Updating admin: {email}"))

        user.email = email
        user.user_type = User.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.kyc_status = User.KYC_VERIFIED
        user.set_password(password)
        user.save()

        self.stdout.write(
            self.style.SUCCESS(
                "Done. Log in on the frontend with this email/password (Cridora admin). "
                "Django admin: /monkey123/"
            )
        )
