import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0015_platformconfig_sell_share_pct'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SellOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('qty_grams', models.DecimalField(decimal_places=4, max_digits=10)),
                ('buyback_rate_per_gram', models.DecimalField(decimal_places=4, max_digits=10)),
                ('purchase_rate_per_gram', models.DecimalField(decimal_places=4, max_digits=10)),
                ('gross_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('purchase_cost_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('profit_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('cridora_share_pct', models.DecimalField(decimal_places=2, max_digits=5)),
                ('cridora_share_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('net_payout_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(
                    choices=[
                        ('pending_vendor',  'Awaiting Vendor'),
                        ('vendor_accepted', 'Payment Initiated'),
                        ('admin_approved',  'Admin Approved'),
                        ('completed',       'Completed'),
                        ('rejected',        'Rejected'),
                    ],
                    default='pending_vendor',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(
                    limit_choices_to={'user_type': 'customer'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sell_orders',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('buy_order', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='sell_orders',
                    to='users.order',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
