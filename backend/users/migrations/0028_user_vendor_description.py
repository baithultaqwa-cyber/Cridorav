# User.vendor_description for public vendor listings

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0027_product_wishlist_item'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='vendor_description',
            field=models.TextField(blank=True, default=''),
        ),
    ]
