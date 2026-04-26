from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0036_eod_vendor_ledger_window"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_expires_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="platformconfig",
            name="payment_complete_ttl_seconds",
            field=models.PositiveIntegerField(default=300),
        ),
    ]
