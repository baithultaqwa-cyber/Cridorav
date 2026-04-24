# User.vendor_logo for public vendor page branding

import cridora.catalog_storage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0028_user_vendor_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='vendor_logo',
            field=models.ImageField(
                blank=True,
                null=True,
                storage=cridora.catalog_storage.get_catalog_media_storage,
                upload_to='vendor_logos/%Y/%m/',
            ),
        ),
    ]
