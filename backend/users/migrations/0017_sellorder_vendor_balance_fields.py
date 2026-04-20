from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [('users', '0016_sellorder')]

    operations = [
        migrations.AddField(
            model_name='sellorder',
            name='vendor_balance_used',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='sellorder',
            name='vendor_pool_balance_at_accept',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
