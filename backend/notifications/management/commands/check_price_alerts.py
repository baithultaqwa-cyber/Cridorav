"""
Compare live spot prices to last-notified levels and broadcast movement alerts.

Schedule on Railway Cron (or OS cron), e.g. every 10 minutes:

    python manage.py check_price_alerts

Env (optional):
  PRICE_ALERT_THRESHOLD_PCT     default 1.0 (set to 0 to alert on any detected move)
  PRICE_ALERT_COOLDOWN_MINUTES  default 30  (set to 0 to disable the cooldown)
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.models import PriceAlertState
from notifications.services import (
    broadcast_price_alert,
    price_alert_cooldown_minutes,
    price_alert_threshold_pct,
)


def _spot_aed_per_gram(payload, metal: str):
    if not payload:
        return None
    block = payload.get(metal)
    if not isinstance(block, dict):
        return None
    if metal == 'gold':
        v = block.get('24K') or block.get('24k')
    elif metal == 'silver':
        v = block.get('999')
    else:
        v = next((x for x in block.values() if isinstance(x, (int, float))), None)
    if v is None:
        return None
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


class Command(BaseCommand):
    help = 'Broadcast Web Push alerts when gold/silver spot moves beyond threshold.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Ignore cooldown (still requires threshold move vs last notified).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Log what would be sent without creating notifications.',
        )

    def handle(self, *args, **options):
        from cridora.spot_prices import get_spot_payload_raw_unmarginated

        payload = get_spot_payload_raw_unmarginated()
        if not payload:
            self.stdout.write(self.style.WARNING('No spot payload available; skipping.'))
            return

        threshold = price_alert_threshold_pct()
        cooldown = timedelta(minutes=price_alert_cooldown_minutes())
        now = timezone.now()
        dry = options['dry_run']
        force = options['force']

        for metal in ('gold', 'silver'):
            price = _spot_aed_per_gram(payload, metal)
            if price is None:
                self.stdout.write(f'{metal}: no price in payload')
                continue

            state, _ = PriceAlertState.objects.get_or_create(metal=metal)
            if state.last_notified_price is None:
                if not dry:
                    state.last_notified_price = Decimal(str(round(price, 4)))
                    state.last_notified_at = now
                    state.save(update_fields=['last_notified_price', 'last_notified_at', 'updated_at'])
                self.stdout.write(f'{metal}: seeded baseline at {price:.4f}')
                continue

            old = float(state.last_notified_price)
            if old <= 0:
                continue
            if price == old:
                self.stdout.write(f'{metal}: unchanged at {price:.4f}')
                continue
            pct = ((price - old) / old) * 100.0
            if abs(pct) < threshold:
                self.stdout.write(f'{metal}: move {pct:.3f}% below threshold {threshold}%')
                continue

            if (
                not force
                and state.last_notified_at
                and (now - state.last_notified_at) < cooldown
            ):
                self.stdout.write(f'{metal}: within cooldown ({cooldown})')
                continue

            self.stdout.write(
                self.style.SUCCESS(
                    f'{metal}: {old:.4f} → {price:.4f} ({pct:+.2f}%) — broadcasting'
                )
            )
            if dry:
                continue

            sent = broadcast_price_alert(metal, old, price, pct)
            state.last_notified_price = Decimal(str(round(price, 4)))
            state.last_notified_at = now
            state.save(update_fields=['last_notified_price', 'last_notified_at', 'updated_at'])
            self.stdout.write(f'{metal}: notified {sent} users')
