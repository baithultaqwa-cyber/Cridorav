# Generated manually for per-purity live spot + markup

from django.db import migrations, models

_DEFAULT_GOLD = ['24K', '22K', '21K', '18K', '999.9', '999', '916']
_DEFAULT_SILVER = ['999', '999.9', '925', '958']


def forwards(apps, schema_editor):
    VendorPricingConfig = apps.get_model('users', 'VendorPricingConfig')
    for cfg in VendorPricingConfig.objects.all():
        g_opts = list(cfg.gold_purity_options) if cfg.gold_purity_options else _DEFAULT_GOLD
        s_opts = list(cfg.silver_purity_options) if cfg.silver_purity_options else _DEFAULT_SILVER
        g_pur = {**dict(cfg.gold_gram_rates_by_purity or {})}
        s_pur = {**dict(cfg.silver_gram_rates_by_purity or {})}
        g_keys = set(g_opts) | set(g_pur.keys())
        s_keys = set(s_opts) | set(s_pur.keys())
        gp = dict(cfg.gold_purity_pricing or {}) if isinstance(cfg.gold_purity_pricing, dict) else {}
        sp = dict(cfg.silver_purity_pricing or {}) if isinstance(cfg.silver_purity_pricing, dict) else {}
        for k in g_keys:
            if not k or not str(k).strip():
                continue
            ks = str(k).strip()
            if ks in gp and isinstance(gp[ks], dict) and 'use_live' in gp[ks]:
                continue
            gp[ks] = {
                'use_live': bool(cfg.use_home_spot_gold),
                'markup_pct': _markup_from_block(gp.get(ks) or {}),
            }
        for k in s_keys:
            if not k or not str(k).strip():
                continue
            ks = str(k).strip()
            if ks in sp and isinstance(sp[ks], dict) and 'use_live' in sp[ks]:
                continue
            sp[ks] = {
                'use_live': bool(cfg.use_home_spot_silver),
                'markup_pct': _markup_from_block(sp.get(ks) or {}),
            }
        cfg.gold_purity_pricing = gp
        cfg.silver_purity_pricing = sp
        cfg.save(update_fields=['gold_purity_pricing', 'silver_purity_pricing'])


def _markup_from_block(b):
    try:
        v = b.get('markup_pct', 0)
        return float(v) if v is not None and str(v).strip() != '' else 0.0
    except (TypeError, ValueError):
        return 0.0


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0029_user_vendor_logo'),
    ]

    operations = [
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='gold_purity_pricing',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='vendorpricingconfig',
            name='silver_purity_pricing',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(forwards, backwards),
    ]
