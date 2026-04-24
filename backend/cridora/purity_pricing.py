"""Per-purity gram rates (AED/g) and buyback resolution for catalog products."""


def _to_float(x):
    if x is None or x is '':
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
