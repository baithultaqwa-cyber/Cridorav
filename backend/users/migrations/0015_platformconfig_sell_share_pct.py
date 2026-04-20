from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('users', '0014_order_metal_rate_per_gram')]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='sell_share_pct',
            field=models.DecimalField(decimal_places=2, default=5.00, max_digits=5),
        ),
    ]
