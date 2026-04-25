from django.core.management.base import BaseCommand

from users.payment_checkout_expiry import expire_due_stripe_checkout_orders


class Command(BaseCommand):
    help = "Expire Stripe Checkout sessions past the payment deadline and set orders to payment_expired."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=500,
            help="Max orders to process per run (default 500).",
        )

    def handle(self, *args, **options):
        n = expire_due_stripe_checkout_orders(limit=options["limit"])
        self.stdout.write(self.style.SUCCESS(f"Processed {n} order(s)."))
