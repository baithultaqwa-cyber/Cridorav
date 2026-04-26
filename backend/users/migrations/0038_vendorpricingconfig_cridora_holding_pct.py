from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0037_payment_timeout_controls"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendorpricingconfig",
            name="cridora_holding_pct",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
    ]
