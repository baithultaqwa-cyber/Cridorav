from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from io import StringIO

from users.models import User


class BootstrapAdminCommandTests(TestCase):
    def test_skips_when_env_empty(self):
        out = StringIO()
        with self.settings():
            call_command("bootstrap_admin", stdout=out)
        self.assertIn("Skipping", out.getvalue())

    def test_creates_admin_from_email_and_password(self):
        env = {
            "CRIDORA_ADMIN_EMAIL": "ops@cridora.test",
            "CRIDORA_ADMIN_PASSWORD": "StrongPass9x",
            "CRIDORA_ADMIN_USERNAME": "ops_admin",
        }
        with self.settings():
            from unittest.mock import patch
            with patch.dict("os.environ", env, clear=False):
                call_command("bootstrap_admin", stdout=StringIO())
        user = User.objects.get(email="ops@cridora.test")
        self.assertEqual(user.user_type, User.ADMIN)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("StrongPass9x"))
        self.assertEqual(user.username, "ops_admin")

    def test_updates_existing_by_user_id(self):
        user = User.objects.create_user(
            username="oldadmin", email="old@cridora.test", password="OldPass9x",
            user_type=User.CUSTOMER,
        )
        env = {
            "CRIDORA_ADMIN_USER_ID": str(user.id),
            "CRIDORA_ADMIN_EMAIL": "new@cridora.test",
            "CRIDORA_ADMIN_USERNAME": "newadmin",
            "CRIDORA_ADMIN_PASSWORD": "NewPass9x!",
        }
        from unittest.mock import patch
        with patch.dict("os.environ", env, clear=False):
            call_command("bootstrap_admin", stdout=StringIO())
        user.refresh_from_db()
        self.assertEqual(user.email, "new@cridora.test")
        self.assertEqual(user.username, "newadmin")
        self.assertEqual(user.user_type, User.ADMIN)
        self.assertTrue(user.check_password("NewPass9x!"))

    def test_rejects_unknown_user_id(self):
        env = {
            "CRIDORA_ADMIN_USER_ID": "999999",
            "CRIDORA_ADMIN_EMAIL": "x@cridora.test",
            "CRIDORA_ADMIN_PASSWORD": "StrongPass9x",
        }
        from unittest.mock import patch
        with patch.dict("os.environ", env, clear=False):
            with self.assertRaises(CommandError):
                call_command("bootstrap_admin", stdout=StringIO())
