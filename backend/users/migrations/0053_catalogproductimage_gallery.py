import os

from django.db import migrations, models
import django.db.models.deletion

import cridora.catalog_storage


def forwards_copy_cover_to_gallery(apps, schema_editor):
    CatalogProduct = apps.get_model('users', 'CatalogProduct')
    CatalogProductImage = apps.get_model('users', 'CatalogProductImage')
    for p in CatalogProduct.objects.exclude(image='').exclude(image__isnull=True).iterator():
        if CatalogProductImage.objects.filter(product_id=p.id).exists():
            continue
        if not p.image:
            continue
        CatalogProductImage.objects.create(
            product_id=p.id,
            image=p.image.name,
            sort_order=0,
        )


def backwards_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0052_platform_config_admin_fees_timers'),
    ]

    operations = [
        migrations.CreateModel(
            name='CatalogProductImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(storage=cridora.catalog_storage.get_catalog_media_storage, upload_to='catalog_images/%Y/%m/')),
                ('sort_order', models.PositiveSmallIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('product', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='gallery_images', to='users.catalogproduct')),
            ],
            options={
                'ordering': ['sort_order', 'id'],
            },
        ),
        migrations.RunPython(forwards_copy_cover_to_gallery, backwards_noop),
    ]
