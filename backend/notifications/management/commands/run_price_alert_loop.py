"""
Keep the external spot feed warm so change-driven price alerts can fire promptly.

Notifications are NOT sent on this interval. Pushes only go out when
`evaluate_and_broadcast_price_moves` sees a real price change vs last notified
(triggered here after each forced feed refresh, and also from any other fresh
spot fetch in the web app).

This process still runs as the cridora-price-cron container's main command
(RUN_MODE=price_cron) because Railway's native cron schedule was unreliable
for this service.

Env (optional):
  PRICE_ALERT_LOOP_INTERVAL_SECONDS   default 30 (how often to *check* the feed)
"""
import logging
import time

from django.conf import settings
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Poll the spot feed; push only when gold/silver price actually changes.'

    def handle(self, *args, **options):
        try:
            # Allow sub-minute checks so a move is noticed soon after the feed updates.
            interval = max(15, int(getattr(settings, 'PRICE_ALERT_LOOP_INTERVAL_SECONDS', 30)))
        except (TypeError, ValueError):
            interval = 30

        self.stdout.write(
            self.style.SUCCESS(
                f'price-change watcher starting (feed check every {interval}s; '
                f'push only on actual price moves)'
            )
        )
        while True:
            try:
                from cridora.spot_prices import get_spot_payload_raw_unmarginated
                from notifications.services import evaluate_and_broadcast_price_moves

                # Force a fresh external fetch; evaluate inline (no async double-fire).
                payload = get_spot_payload_raw_unmarginated(
                    force_refresh=True,
                    schedule_alerts=False,
                )
                for msg in evaluate_and_broadcast_price_moves(payload=payload):
                    self.stdout.write(msg)
            except Exception:
                logger.exception('price-change watcher tick failed; continuing')
            time.sleep(interval)
