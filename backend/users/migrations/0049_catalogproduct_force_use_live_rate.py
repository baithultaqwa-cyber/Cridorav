# Pricing consolidation: per-product manual rate override removed —
# all catalog SKUs now resolve rates from VendorPricingConfig.

from django.db import migrations


def forwards(apps, schema_editor):
    CatalogProduct = apps.get_model('users', 'CatalogProduct')
    CatalogProduct.objects.filter(use_live_rate=False).update(use_live_rate=True)


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0048_kyc_document_expiry_and_more_docs'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
