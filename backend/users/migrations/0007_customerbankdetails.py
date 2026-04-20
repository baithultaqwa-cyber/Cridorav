from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_vendorpricingconfig_gold_buyback_deduction_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerBankDetails',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('account_name', models.CharField(blank=True, max_length=200)),
                ('bank_name', models.CharField(blank=True, max_length=200)),
                ('account_number', models.CharField(blank=True, max_length=100)),
                ('ifsc', models.CharField(blank=True, max_length=50)),
                ('status', models.CharField(
                    choices=[
                        ('not_added', 'Not Added'),
                        ('pending', 'Pending Review'),
                        ('verified', 'Verified'),
                    ],
                    default='not_added',
                    max_length=20,
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    limit_choices_to={'user_type': 'customer'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='bank_details',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Customer Bank Details',
            },
        ),
    ]
