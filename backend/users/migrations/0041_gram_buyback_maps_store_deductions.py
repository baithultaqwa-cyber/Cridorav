# Convert legacy per-purity buyback map values that stored *absolute* AED/g
# customer payback into *deductions* (live sell − value), matching current product semantics.

from django.db import migrations


def _sell_for_purity(rate_m, pur, base_rate):
    if not rate_m:
        return float(base_rate) if base_rate and base_rate > 0 else None
    p = (pur or "").strip()
    if p in rate_m and rate_m[p] not in (None, ""):
        try:
            v = float(rate_m[p])
            if v > 0:
                return v
        except (TypeError, ValueError):
            pass
    pl = p.lower()
    for k, v in rate_m.items():
        if str(k).strip().lower() == pl and v not in (None, ""):
            try:
                vf = float(v)
                if vf > 0:
                    return vf
            except (TypeError, ValueError):
                pass
    br = float(base_rate or 0)
    return br if br > 0 else None


def convert_gram_buyback_maps_to_deductions(apps, schema_editor):
    VendorPricingConfig = apps.get_model("users", "VendorPricingConfig")
    for cfg in VendorPricingConfig.objects.all():
        any_change = False
        for metal in ("gold", "silver", "platinum", "palladium"):
            rkey = f"{metal}_gram_rates_by_purity"
            bkey = f"{metal}_gram_buybacks_by_purity"
            rate_m = dict(getattr(cfg, rkey) or {})
            buy_m = dict(getattr(cfg, bkey) or {})
            if not buy_m:
                continue
            base = float(getattr(cfg, f"{metal}_rate", 0) or 0)
            new_buy = dict(buy_m)
            for pur, old_raw in list(buy_m.items()):
                if old_raw is None or (isinstance(old_raw, str) and not str(old_raw).strip()):
                    continue
                try:
                    o = float(old_raw)
                except (TypeError, ValueError):
                    continue
                sell = _sell_for_purity(rate_m, pur, base)
                if not sell or sell <= 0:
                    continue
                if o > sell * 0.5 and o <= sell * 1.02:
                    ded = max(0.0, sell - o)
                    new_buy[pur] = round(ded, 4)
                    any_change = True
            setattr(cfg, bkey, new_buy)
        if any_change:
            cfg.save(
                update_fields=[
                    "gold_gram_buybacks_by_purity",
                    "silver_gram_buybacks_by_purity",
                    "platinum_gram_buybacks_by_purity",
                    "palladium_gram_buybacks_by_purity",
                ]
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0040_adminvendorpayout_proof_optional"),
    ]

    operations = [
        migrations.RunPython(convert_gram_buyback_maps_to_deductions, noop_reverse),
    ]
