"""
Self-scheduling wrapper around `check_price_alerts`, run as the container's
main process on the price-cron service.

Why this exists: that service is meant to run on Railway's native cron
schedule (deploy.cronSchedule), but this service's deployment pipeline has
gotten stuck treating it as a plain Docker-image deploy, which silently
ignores the cron/startCommand service settings and just runs the image's
default CMD. Looping in-process sidesteps that platform quirk entirely —
whatever this container's CMD is, it now supplies its own 10-minute cadence
instead of depending on Railway to invoke it repeatedly.

Env (optional):
  PRICE_ALERT_LOOP_INTERVAL_SECONDS   default 600 (10 minutes)
"""
import logging
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run check_price_alerts forever, sleeping between runs.'

    def handle(self, *args, **options):
        try:
            interval = max(60, int(getattr(settings, 'PRICE_ALERT_LOOP_INTERVAL_SECONDS', 600)))
        except (TypeError, ValueError):
            interval = 600

        self.stdout.write(self.style.SUCCESS(f'price-alert loop starting (every {interval}s)'))
        while True:
            try:
                call_command('check_price_alerts')
            except Exception:
                logger.exception('check_price_alerts raised in loop; continuing')
            time.sleep(interval)
