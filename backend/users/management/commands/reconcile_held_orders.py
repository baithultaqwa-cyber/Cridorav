"""Weekly held-orders reconciliation stub (v7 Phase 3)."""
from django.core.management.base import BaseCommand
from django.utils import timezone

from users.models import Order


class Command(BaseCommand):
    help = 'Reconcile held / paid order stock vs portfolio snapshots (ops report).'

    def handle(self, *args, **options):
        held = Order.objects.filter(status__in=Order.COMPLETED_HOLDING_STATUSES).count()
        sold = Order.objects.filter(status=Order.SOLD_BACK).count()
        cancelled = Order.objects.filter(status=Order.CANCELLED).count()
        self.stdout.write(
            self.style.SUCCESS(
                f'[{timezone.now().isoformat()}] held_or_paid={held} sold_back={sold} cancelled={cancelled}'
            )
        )
        self.stdout.write('Reconciliation stub complete — wire email/KPI export as needed.')
