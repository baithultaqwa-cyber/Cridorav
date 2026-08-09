from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0055_phone_verified_kyc_profile'),
    ]

    operations = [
        migrations.AlterField(
            model_name='orderredemption',
            name='otp_code',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
