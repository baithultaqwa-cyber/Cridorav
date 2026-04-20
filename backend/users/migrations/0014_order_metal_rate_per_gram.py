from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0013_order_status_rework'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='metal_rate_per_gram',
            field=models.DecimalField(decimal_places=4, default=0, max_digits=10),
        ),
    ]
