"""Per-purity gram rates (AED/g) and buyback resolution for catalog products."""


def _to_float(x):
    if x is None or x == '':
        return None
    try:
        v = float(x)
        if v < 0 or v > 1e9:
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
    v, found = get_from_purity_map(m, purity_label)
    if found and v is not None:
        return max(0.0, float(v))
    return max(0.0, float(sell_per_gram) - float(metal_deduction or 0))


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


def get_purity_spot_config(cfg, metal, purity_label):
    """
    Per fineness: use_live + markup_pct.
    If the fineness is missing, fall back to use_home_spot_gold / use_home_spot_silver.
    """
    d = _purity_pricing_map(cfg, metal)
    p = (purity_label or '').strip()
    if not p:
        use_live = bool(getattr(cfg, f'use_home_spot_{metal}', False)) if metal in ('gold', 'silver') else False
        return {'use_live': use_live, 'markup_pct': 0.0}
    block = d.get(p)
    if block is None and p:
        for k, v in d.items():
            if str(k).strip().lower() == p.lower() and isinstance(v, dict):
                block = v
                break
    if not block or not isinstance(block, dict):
        use_live = bool(getattr(cfg, f'use_home_spot_{metal}', False)) if metal in ('gold', 'silver') else False
        return {'use_live': use_live, 'markup_pct': 0.0}
    use_live = bool(block.get('use_live', getattr(cfg, f'use_home_spot_{metal}', False)))
    try:
        mup = float(block.get('markup_pct', 0) or 0)
    except (TypeError, ValueError):
        mup = 0.0
    if mup < 0 or mup > 1e4:
        mup = 0.0
    return {'use_live': use_live, 'markup_pct': mup}


def resolve_effective_gram_sell_cridora(cfg, metal, purity):
    """
    Gold/silver only: unmarginated spot + optional markup, or manual gram map, or None (use legacy metal rate).
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
                mup = 1.0 + float(conf['markup_pct']) / 100.0
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
        try:
            mup = float(v.get('markup_pct', 0) or 0)
        except (TypeError, ValueError):
            mup = 0.0
        if mup < 0 or mup > 1e4:
            mup = 0.0
        out[key] = {'use_live': use_live, 'markup_pct': mup}
    return out
