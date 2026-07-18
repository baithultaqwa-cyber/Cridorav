from django.core.management.base import BaseCommand

from notifications.push_backend import _vapid_private_key, vapid_configured


class Command(BaseCommand):
    help = 'One-off: verify VAPID key parsing on the deployed environment.'

    def handle(self, *args, **options):
        self.stdout.write(f'vapid_configured(): {vapid_configured()}')
        vv = _vapid_private_key()
        self.stdout.write(f'Parsed OK: {type(vv).__name__}, has private key: {vv.private_key is not None}')
