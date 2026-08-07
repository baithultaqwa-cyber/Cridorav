from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0053_catalogproductimage_gallery'),
    ]

    operations = [
        migrations.CreateModel(
            name='MetalRateMovement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('captured_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('gold_24k_aed_per_gram', models.DecimalField(decimal_places=4, max_digits=14)),
                ('gold_22k_aed_per_gram', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('gold_21k_aed_per_gram', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('gold_18k_aed_per_gram', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('silver_999_aed_per_gram', models.DecimalField(decimal_places=4, max_digits=14)),
                ('silver_925_aed_per_gram', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('copper_999_aed_per_gram', models.DecimalField(blank=True, decimal_places=6, max_digits=14, null=True)),
                ('prev_gold_24k', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('prev_silver_999', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('gold_delta', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('silver_delta', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('spot_payload_source', models.CharField(blank=True, default='', max_length=48)),
                ('spot_payload', models.JSONField(blank=True, default=dict)),
            ],
            options={
                'verbose_name': 'Metal rate movement',
                'verbose_name_plural': 'Metal rate movements',
                'ordering': ['-captured_at'],
            },
        ),
        migrations.CreateModel(
            name='MarketComparisonSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('captured_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('reason', models.CharField(choices=[('rate_change', 'Rate change'), ('matrix_refresh', 'Matrix refresh'), ('scheduled', 'Scheduled')], default='matrix_refresh', max_length=32)),
                ('cridora_reference_24k', models.DecimalField(blank=True, decimal_places=4, max_digits=14, null=True)),
                ('spot_source', models.CharField(blank=True, default='', max_length=48)),
                ('currency', models.CharField(default='AED', max_length=8)),
                ('unit', models.CharField(default='per_gram', max_length=32)),
                ('matrix_payload', models.JSONField(blank=True, default=dict)),
                ('rows', models.JSONField(blank=True, default=list)),
                ('movement', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='comparisons', to='users.metalratemovement')),
            ],
            options={
                'verbose_name': 'Market comparison snapshot',
                'verbose_name_plural': 'Market comparison snapshots',
                'ordering': ['-captured_at'],
            },
        ),
        migrations.AddIndex(
            model_name='metalratemovement',
            index=models.Index(fields=['-captured_at', 'gold_24k_aed_per_gram'], name='users_metal_capture_b6cbc7_idx'),
        ),
    ]
