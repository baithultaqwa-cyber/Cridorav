from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_customerbankdetails'),
    ]

    operations = [
        migrations.CreateModel(
            name='PlatformConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('buy_fee_pct', models.DecimalField(decimal_places=2, default=0.5, max_digits=5)),
                ('sell_fee_pct', models.DecimalField(decimal_places=2, default=0.5, max_digits=5)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Platform Configuration',
            },
        ),
    ]
