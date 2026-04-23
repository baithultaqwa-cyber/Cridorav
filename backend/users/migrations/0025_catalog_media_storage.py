# Catalog / staging images use cridora.catalog_storage (local disk or S3).

import cridora.catalog_storage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0024_catalog_staging_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='catalogproduct',
            name='image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='catalog_images/%Y/%m/',
                storage=cridora.catalog_storage.get_catalog_media_storage,
            ),
        ),
        migrations.AlterField(
            model_name='catalogstagingimage',
            name='image',
            field=models.ImageField(
                upload_to='catalog_staging/%Y/%m/',
                storage=cridora.catalog_storage.get_catalog_media_storage,
            ),
        ),
    ]
