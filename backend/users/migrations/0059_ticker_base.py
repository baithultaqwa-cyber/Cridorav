# Ticker base: Cridora wallet = (international | dubai_retail) × (1 + markup%).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0058_order_principal_trading_lock'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformconfig',
            name='ticker_base',
            field=models.CharField(
                choices=[
                    ('international', 'International spot (Rate A)'),
                    ('dubai_retail', 'Dubai official retail (Rate B)'),
                ],
                default='international',
                help_text='Base rate for Cridora wallet ticker before markup %.',
                max_length=32,
            ),
        ),
    ]
