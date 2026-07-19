# Generated manually for OrderRedemption (per-unit physical redemption OTP flow).

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('users', '0049_catalogproduct_force_use_live_rate'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderRedemption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('qty_units', models.PositiveIntegerField()),
                ('qty_grams', models.DecimalField(decimal_places=4, max_digits=10)),
                ('status', models.CharField(
                    choices=[
                        ('otp_pending', 'OTP Pending'),
                        ('redeemed', 'Redeemed'),
                        ('cancelled', 'Cancelled'),
                        ('expired', 'Expired'),
                    ],
                    default='otp_pending',
                    max_length=20,
                )),
                ('otp_code', models.CharField(blank=True, default='', max_length=6)),
                ('otp_expires_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('otp_attempts', models.PositiveIntegerField(default=0)),
                ('requested_by', models.CharField(
                    choices=[('customer', 'Customer'), ('vendor', 'Vendor')],
                    default='customer',
                    max_length=16,
                )),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('remark', models.TextField(blank=True, default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('customer', models.ForeignKey(
                    limit_choices_to={'user_type': 'customer'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='order_redemptions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='redemptions',
                    to='users.order',
                )),
            ],
            options={
                'ordering': ['-requested_at'],
            },
        ),
    ]
