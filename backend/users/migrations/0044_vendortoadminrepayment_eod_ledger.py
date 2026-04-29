import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0043_sellorder_vendor_response_expires_cancelled"),
    ]

    operations = [
        migrations.AddField(
            model_name="vendortoadminrepayment",
            name="eod_ledger",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="vendor_repayments",
                to="users.eodvendorledger",
            ),
        ),
    ]
