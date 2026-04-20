import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_alter_catalogproduct_id_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='VendorSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('opening_time', models.TimeField(blank=True, null=True)),
                ('closing_time', models.TimeField(blank=True, null=True)),
                ('timezone', models.CharField(default='Asia/Dubai', max_length=50)),
                ('holiday_dates', models.JSONField(blank=True, default=list)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('vendor', models.OneToOneField(
                    limit_choices_to={'user_type': 'vendor'},
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='schedule',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Vendor Schedule',
            },
        ),
    ]
