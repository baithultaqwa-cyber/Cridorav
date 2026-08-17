# Generated manually for principal-trading pricing engine (Phase 1).

from decimal import Decimal

from django.db import migrations, models


def seed_wallet_markup_and_zero_buy_fee(apps, schema_editor):
    PlatformConfig = apps.get_model('users', 'PlatformConfig')
    for cfg in PlatformConfig.objects.all():
        legacy = cfg.home_spot_display_margin_pct or Decimal('0')
        # Seed per-metal wallet markup from legacy single margin when unset.
        if (cfg.wallet_markup_pct_gold or Decimal('0')) == Decimal('0') and legacy:
            cfg.wallet_markup_pct_gold = legacy
        if (cfg.wallet_markup_pct_silver or Decimal('0')) == Decimal('0') and legacy:
            cfg.wallet_markup_pct_silver = legacy
        # Spread carries revenue — retire default 0.5% service fee.
        cfg.buy_fee_pct = Decimal('0')
        cfg.save()


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0056_orderredemption_otp_hash_length'),
    ]

    operations = [
        migrations.AlterField(
            model_name='platformconfig',
            name='buy_fee_pct',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='wallet_markup_pct_gold',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='wallet_markup_pct_silver',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_source_url',
            field=models.URLField(blank=True, default='https://www.dubaicityofgold.com/'),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_manual_override',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_manual_override_gold_24k_aed_per_g',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_manual_override_silver_999_aed_per_g',
            field=models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_staleness_max_minutes',
            field=models.PositiveIntegerField(default=15),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_b_stale_policy',
            field=models.CharField(default='hold_last_warn', max_length=32),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='min_profit_floor_aed_per_g_gold',
            field=models.DecimalField(decimal_places=4, default=3.0, max_digits=10),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='min_profit_floor_aed_per_g_silver',
            field=models.DecimalField(decimal_places=4, default=0.15, max_digits=10),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='ceiling_epsilon_aed_per_g',
            field=models.DecimalField(decimal_places=4, default=0.5, max_digits=10),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='ceiling_cross_policy',
            field=models.CharField(default='warn_only', max_length=32),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='card_cost_pct',
            field=models.DecimalField(decimal_places=2, default=2.5, max_digits=5),
        ),
        migrations.AddField(
            model_name='platformconfig',
            name='rate_lock_window_seconds',
            field=models.PositiveIntegerField(default=120),
        ),
        migrations.RunPython(seed_wallet_markup_and_zero_buy_fee, noop_reverse),
    ]
