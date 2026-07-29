"""
Compare live spot prices to last-notified levels and broadcast movement alerts.

Prefer calling this whenever a fresh spot snapshot arrives (see
`schedule_price_change_alerts` in notifications.services / spot_prices).
Still useful as a one-shot CLI / loop fallback.

Env (optional):
  PRICE_ALERT_THRESHOLD_PCT     default 1.0 (set to 0 to alert on any detected move)
  PRICE_ALERT_COOLDOWN_MINUTES  default 30  (set to 0 to disable the cooldown)
"""
from django.core.management.base import BaseCommand

from notifications.services import evaluate_and_broadcast_price_moves


class Command(BaseCommand):
    help = 'Broadcast Web Push alerts when gold/silver spot has moved since last notify.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Ignore cooldown (still requires a real price change vs last notified).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Log what would be sent without creating notifications.',
        )

    def handle(self, *args, **options):
        messages = evaluate_and_broadcast_price_moves(
            force=options['force'],
            dry_run=options['dry_run'],
        )
        for msg in messages:
            if 'broadcasting' in msg or 'notified' in msg or 'seeded' in msg:
                self.stdout.write(self.style.SUCCESS(msg))
            elif 'skipping' in msg or 'no spot' in msg:
                self.stdout.write(self.style.WARNING(msg))
            else:
                self.stdout.write(msg)
