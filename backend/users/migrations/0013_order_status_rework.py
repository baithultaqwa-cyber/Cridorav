from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0012_vendorschedule'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('pending_vendor',  'Awaiting Vendor'),
                    ('vendor_accepted', 'Accepted \u2013 Pending Payment'),
                    ('paid',            'Completed'),
                    ('rejected',        'Rejected'),
                    ('expired',         'Expired'),
                ],
                default='pending_vendor',
            ),
        ),
    ]
