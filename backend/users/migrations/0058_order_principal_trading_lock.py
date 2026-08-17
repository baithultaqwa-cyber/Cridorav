# Principal-trading order lock fields (wallet/card tier, landed cost, profit).

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0057_principal_trading_pricing'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='payment_tier',
            field=models.CharField(
                blank=True,
                choices=[('wallet', 'Wallet / Aani'), ('card', 'Card')],
                default='wallet',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='wallet_rate_per_gram',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='card_rate_per_gram',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='vendor_landed_cost_per_gram',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='profit_per_gram',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='replenishment_vendor',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'user_type': 'vendor'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='replenishment_orders',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
