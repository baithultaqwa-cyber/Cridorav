from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_platformconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='quote_ttl_seconds',
            field=models.PositiveIntegerField(default=60),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='vendor_accept_ttl_seconds',
            field=models.PositiveIntegerField(default=60),
        ),
    ]
