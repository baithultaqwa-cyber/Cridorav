"""Per-purity gram rates (AED/g) and buyback resolution for catalog products."""

import math


def _to_float(x):
    if x is None or x == '':
        return None
    try:
        v = float(x)
        if not math.isfinite(v) or v < 0 or v > 1e9:
            return None
        return v
    except (TypeError, ValueError):
        return None


def get_from_purity_map(m, purity_label):
    """
    Return (value, found) for a purity string key. Keys are case-insensitive on match.
    found is True when the key exists in the map (even if the value is invalid).
    """
    if not m or not isinstance(m, dict):
        return None, False
    p = (purity_label or "").strip()
    if not p:
        return None, False
    if p in m:
        if m[p] is None or str(m[p]).strip() == "":
            return None, True
        v = _to_float(m[p])
        return (v, True)
    pl = p.lower()
    for k, val in m.items():
        if str(k).strip().lower() == pl:
            if val is None or str(val).strip() == "":
                return None, True
            v2 = _to_float(val)
            return (v2, True)
    return None, False


def get_metal_gram_map(cfg, metal):
    attr = f"{metal}_gram_rates_by_purity"
    m = getattr(cfg, attr, None)
    if m is not None and isinstance(m, dict):
        return m
    return {}


def get_metal_buyback_map(cfg, metal):
    attr = f"{metal}_gram_buybacks_by_purity"
    m = getattr(cfg, attr, None)
    if m is not None and isinstance(m, dict):
        return m
    return {}


def resolve_gram_sell_per_gram(m, purity_label):
    v, found = get_from_purity_map(m, purity_label)
    if v is not None and v > 0:
        return v
    return None


def resolve_gram_buyback_per_gram(m, purity_label, sell_per_gram, metal_deduction):
    """
    Per-purity map values are AED/g *deducted* from the effective sell rate.
    Customer buyback = max(0, sell - deduction). If the map key is missing or
    empty for this fineness, fall back to the metal default deduction.
    """
    try:
        sell_f = float(sell_per_gram)
    except (TypeError, ValueError):
        sell_f = 0.0
    if not math.isfinite(sell_f):
        sell_f = 0.0
    try:
        ded_f = float(metal_deduction or 0)
    except (TypeError, ValueError):
        ded_f = 0.0
    if not math.isfinite(ded_f):
        ded_f = 0.0
    v, found = get_from_purity_map(m, purity_label)
    if found and v is not None:
        out = sell_f - float(v)
        if not math.isfinite(out):
            out = 0.0
        return max(0.0, out)
    out2 = sell_f - ded_f
    if not math.isfinite(out2):
        out2 = 0.0
    return max(0.0, out2)


def _purity_pricing_map(cfg, metal):
    if metal == 'gold':
        m = getattr(cfg, 'gold_purity_pricing', None)
    elif metal == 'silver':
        m = getattr(cfg, 'silver_purity_pricing', None)
    else:
        m = None
    if m is not None and isinstance(m, dict):
        return m
    return {}


MARKUP_TYPE_PERCENT = 'percent'
MARKUP_TYPE_FIXED = 'fixed'
MARKUP_TYPES = (MARKUP_TYPE_PERCENT, MARKUP_TYPE_FIXED)


def _coerce_markup_type(v):
    s = str(v or '').strip().lower()
    return s if s in MARKUP_TYPES else MARKUP_TYPE_PERCENT


def _coerce_markup_fields(block):
    """
    Read markup_type + markup_value from a purity-pricing block, falling back to the
    legacy markup_pct-only shape (always percent) for data saved before fixed-value
    markup was supported.
    """
    markup_type = _coerce_markup_type(block.get('markup_type'))
    if 'markup_value' in block:
        raw_value = block.get('markup_value', 0)
    else:
        raw_value = block.get('markup_pct', 0)
        markup_type = MARKUP_TYPE_PERCENT
    try:
        value = float(raw_value or 0)
    except (TypeError, ValueError):
        value = 0.0
    limit = 1e4 if markup_type == MARKUP_TYPE_PERCENT else 1e7
    if value < 0 or value > limit:
        value = 0.0
    return markup_type, value


def get_purity_spot_config(cfg, metal, purity_label):
    """
    Per fineness: use_live + markup (percent over spot, or a fixed AED/g add-on).
    If the fineness is missing, fall back to use_home_spot_gold / use_home_spot_silver.
    """
    d = _purity_pricing_map(cfg, metal)
    p = (purity_label or '').strip()
    empty_markup_type, empty_markup_value = MARKUP_TYPE_PERCENT, 0.0
    if not p:
        use_live = bool(getattr(cfg, f'use_home_spot_{metal}', False)) if metal in ('gold', 'silver') else False
        return {
            'use_live': use_live,
            'markup_type': empty_markup_type,
            'markup_value': empty_markup_value,
            'markup_pct': empty_markup_value,
        }
    block = d.get(p)
    if block is None and p:
        for k, v in d.items():
            if str(k).strip().lower() == p.lower() and isinstance(v, dict):
                block = v
                break
    if not block or not isinstance(block, dict):
        use_live = bool(getattr(cfg, f'use_home_spot_{metal}', False)) if metal in ('gold', 'silver') else False
        return {
            'use_live': use_live,
            'markup_type': empty_markup_type,
            'markup_value': empty_markup_value,
            'markup_pct': empty_markup_value,
        }
    use_live = bool(block.get('use_live', getattr(cfg, f'use_home_spot_{metal}', False)))
    markup_type, markup_value = _coerce_markup_fields(block)
    return {
        'use_live': use_live,
        'markup_type': markup_type,
        'markup_value': markup_value,
        # Back-compat alias for callers that only know about percent markup.
        'markup_pct': markup_value if markup_type == MARKUP_TYPE_PERCENT else 0.0,
    }


def resolve_effective_gram_sell_cridora(cfg, metal, purity):
    """
    Gold/silver only: unmarginated spot + optional markup (percent or fixed AED/g),
    or manual gram map, or None (use legacy metal rate).
    """
    if metal not in ('gold', 'silver'):
        return None
    from cridora.spot_prices import get_spot_payload_raw_unmarginated, gold_rate_for_purity_tier, silver_rate_for_purity_tier

    conf = get_purity_spot_config(cfg, metal, purity)
    raw = get_spot_payload_raw_unmarginated()
    gmap = get_metal_gram_map(cfg, metal)
    v_gram, _ = get_from_purity_map(gmap, purity)
    v_num = v_gram if v_gram is not None and v_gram > 0 else None

    if conf['use_live']:
        if raw:
            if metal == 'gold' and raw.get('gold'):
                t = gold_rate_for_purity_tier(raw['gold'], purity)
            elif metal == 'silver' and raw.get('silver'):
                t = silver_rate_for_purity_tier(raw['silver'], purity)
            else:
                t = None
            if t is not None and t > 0:
                if conf['markup_type'] == MARKUP_TYPE_FIXED:
                    return round(float(t) + float(conf['markup_value']), 4)
                mup = 1.0 + float(conf['markup_value']) / 100.0
                return round(float(t) * mup, 4)
        if v_num is not None:
            return float(v_num)
        return None

    if v_num is not None:
        return float(v_num)
    return None


def coerce_purity_pricing_map(raw):
    if not raw or not isinstance(raw, dict):
        return {}
    out = {}
    for k, v in raw.items():
        key = str(k).strip()
        if not key:
            continue
        if v is None or not isinstance(v, dict):
            continue
        use_live = bool(v.get('use_live', False))
        markup_type, markup_value = _coerce_markup_fields(v)
        out[key] = {
            'use_live': use_live,
            'markup_type': markup_type,
            'markup_value': markup_value,
            # Back-compat alias — older frontend builds / integrations read markup_pct.
            'markup_pct': markup_value if markup_type == MARKUP_TYPE_PERCENT else 0.0,
        }
    return out
