import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_platformconfig_timers'),
    ]

    operations = [
        migrations.CreateModel(
            name='Order',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('qty_units', models.PositiveIntegerField(default=1)),
                ('qty_grams', models.DecimalField(decimal_places=4, max_digits=10)),
                ('rate_per_gram', models.DecimalField(decimal_places=4, max_digits=10)),
                ('buyback_per_gram', models.DecimalField(decimal_places=4, default=0, max_digits=10)),
                ('platform_fee_aed', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('total_aed', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(
                    choices=[
                        ('pending_payment', 'Pending Payment'),
                        ('paid', 'Payment Received'),
                        ('accepted', 'Accepted by Vendor'),
                        ('rejected', 'Rejected'),
                        ('expired', 'Expired'),
                    ],
                    default='pending_payment',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('customer', models.ForeignKey(
                    limit_choices_to={'user_type': 'customer'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='customer_orders',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='orders',
                    to='users.catalogproduct',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
