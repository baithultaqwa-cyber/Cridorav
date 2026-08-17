# Expand ticker_base choices: international | dubai_retail | vendor.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0059_ticker_base'),
    ]

    operations = [
        migrations.AlterField(
            model_name='platformconfig',
            name='ticker_base',
            field=models.CharField(
                choices=[
                    ('international', 'International (vendor-facing Cridora)'),
                    ('dubai_retail', 'Dubai official retail'),
                    ('vendor', 'Vendor rates (best landed)'),
                ],
                default='international',
                help_text=(
                    'Base for customer-facing Cridora ticker before markup %. '
                    'International is also the vendor-facing Cridora reference.'
                ),
                max_length=32,
            ),
        ),
    ]
