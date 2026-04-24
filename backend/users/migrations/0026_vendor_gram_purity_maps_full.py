# Per-fineness sell (AED/g) and buyback JSON maps; seed from legacy single rates if maps empty.

from django.db import migrations, models

_DEFAULT_GOLD = ['24K', '22K', '21K', '18K', '999.9', '999', '916']
_DEFAULT_SILVER = ['999', '999.9', '925', '958']


def seed_gram_maps_from_legacy(apps, schema_editor):
    VendorPricingConfig = apps.get_model('users', 'VendorPricingConfig')
    for cfg in VendorPricingConfig.objects.all():
        g_opts = list(cfg.gold_purity_options or []) or _DEFAULT_GOLD
        s_opts = list(cfg.silver_purity_options or []) or _DEFAULT_SILVER
        gmap = dict(cfg.gold_gram_rates_by_purity or {})
        if not gmap and float(cfg.gold_rate or 0) > 0:
            gr = float(cfg.gold_rate)
            for o in g_opts:
                o = str(o).strip()
                if o:
                    gmap[o] = gr
        smap = dict(cfg.silver_gram_rates_by_purity or {})
        if not smap and float(cfg.silver_rate or 0) > 0:
            sr = float(cfg.silver_rate)
            for o in s_opts:
                o = str(o).strip()
                if o:
                    smap[o] = sr
        gbuy = dict(cfg.gold_gram_buybacks_by_purity or {})
        sbuy = dict(cfg.silver_gram_buybacks_by_purity or {})
        gded = float(cfg.gold_buyback_deduction or 0)
        sded = float(cfg.silver_buyback_deduction or 0)
        for o in g_opts:
            o = str(o).strip()
            if not o or o in gbuy:
                continue
            if o in gmap and float(gmap.get(o) or 0) > 0:
                gbuy[o] = max(0.0, float(gmap[o]) - gded)
        for o in s_opts:
            o = str(o).strip()
            if not o or o in sbuy:
                continue
            if o in smap and float(smap.get(o) or 0) > 0:
                sbuy[o] = max(0.0, float(smap[o]) - sded)
        cfg.gold_gram_rates_by_purity = gmap
        cfg.silver_gram_rates_by_purity = smap
        cfg.gold_gram_buybacks_by_purity = gbuy
        cfg.silver_gram_buybacks_by_purity = sbuy
        cfg.save(
            update_fields=[
                'gold_gram_rates_by_purity', 'silver_gram_rates_by_purity',
                'gold_gram_buybacks_by_purity', 'silver_gram_buybacks_by_purity',
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0025_catalog_media_storage'),
    ]

    operations = [
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='gold_gram_buybacks_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='palladium_gram_buybacks_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='palladium_gram_rates_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='platinum_gram_buybacks_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='platinum_gram_rates_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='silver_gram_buybacks_by_purity',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(seed_gram_maps_from_legacy, migrations.RunPython.noop),
    ]
