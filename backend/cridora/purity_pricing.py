"""Per-purity gram rates (AED/g) and buyback resolution for catalog products.

All rate math uses Decimal (see cridora.money). Float is never used for intermediate
pricing so catalog → order totals stay exchange-grade precise.
"""
from decimal import Decimal

from cridora.money import ZERO, rate_4dp, to_decimal


def _to_decimal_rate(x):
    """Non-negative finite rate, or None if empty/invalid."""
    if x is None or x == '':
        return None
    d = to_decimal(x)
    if d < ZERO or d > Decimal('1000000000'):
        return None
    return d


def get_from_purity_map(m, purity_label):
    """
    Return (value: Decimal|None, found) for a purity string key.
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
        return _to_decimal_rate(m[p]), True
    pl = p.lower()
    for k, val in m.items():
        if str(k).strip().lower() == pl:
            if val is None or str(val).strip() == "":
                return None, True
            return _to_decimal_rate(val), True
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


def get_from_buyback_map_raw(m, purity_label):
    """Return (raw_value, found) for a purity key (case-insensitive)."""
    if not m or not isinstance(m, dict):
        return None, False
    p = (purity_label or "").strip()
    if not p:
        return None, False
    if p in m:
        val = m[p]
        if val is None or (isinstance(val, str) and not str(val).strip()):
            return None, True
        return val, True
    pl = p.lower()
    for k, val in m.items():
        if str(k).strip().lower() == pl:
            if val is None or (isinstance(val, str) and not str(val).strip()):
                return None, True
            return val, True
    return None, False


DEDUCTION_TYPE_PERCENT = 'percent'
DEDUCTION_TYPE_FIXED = 'fixed'
DEDUCTION_TYPES = (DEDUCTION_TYPE_PERCENT, DEDUCTION_TYPE_FIXED)


def normalize_deduction_entry(raw):
    """
    Per-purity buyback deduction: {type: percent|fixed, value: Decimal-compatible}.
    Legacy plain numbers are treated as fixed AED/g.
    Returns None when empty/invalid.
    """
    if raw is None:
        return None
    if isinstance(raw, dict):
        dtype = str(raw.get('type') or raw.get('deduction_type') or DEDUCTION_TYPE_FIXED).strip().lower()
        if dtype not in DEDUCTION_TYPES:
            dtype = DEDUCTION_TYPE_FIXED
        value = to_decimal(raw.get('value', raw.get('amount', 0)) or 0)
    else:
        value = to_decimal(raw)
        dtype = DEDUCTION_TYPE_FIXED
    if value < ZERO:
        return None
    limit = Decimal('100') if dtype == DEDUCTION_TYPE_PERCENT else Decimal('1000000000')
    if value > limit:
        return None
    return {'type': dtype, 'value': value}


def deduction_aed_from_entry(entry, sell_per_gram):
    """Convert a normalized deduction entry into AED/g to subtract from sell."""
    if not entry or not isinstance(entry, dict):
        return ZERO
    sell_d = to_decimal(sell_per_gram)
    value = to_decimal(entry.get('value', 0))
    if value < ZERO:
        value = ZERO
    if entry.get('type') == DEDUCTION_TYPE_PERCENT:
        return sell_d * (value / Decimal('100'))
    return value


def coerce_buyback_purity_map(raw):
    """Normalize buyback map entries to {type, value}; drop empty/invalid keys."""
    if not raw or not isinstance(raw, dict):
        return {}
    out = {}
    for k, v in raw.items():
        key = str(k).strip()
        if not key:
            continue
        if v is None or (isinstance(v, str) and not str(v).strip()):
            continue
        entry = normalize_deduction_entry(v)
        if entry is None:
            continue
        # JSON-safe: value as string
        out[key] = {'type': entry['type'], 'value': format(entry['value'], 'f')}
    return out


def resolve_gram_sell_per_gram(m, purity_label):
    v, found = get_from_purity_map(m, purity_label)
    if v is not None and v > ZERO:
        return rate_4dp(v)
    return None


def resolve_gram_buyback_per_gram(m, purity_label, sell_per_gram, metal_deduction):
    """
    Per-purity map: fixed AED/g or % of effective sell, deducted from sell.
    Customer buyback = max(0, sell - deduction). Missing key → metal default (fixed AED/g).
    """
    sell_d = to_decimal(sell_per_gram)
    ded_d = to_decimal(metal_deduction or 0)
    raw, found = get_from_buyback_map_raw(m, purity_label)
    if found:
        entry = normalize_deduction_entry(raw)
        if entry is not None:
            out = sell_d - deduction_aed_from_entry(entry, sell_d)
            if out < ZERO:
                out = ZERO
            return rate_4dp(out)
    out2 = sell_d - ded_d
    if out2 < ZERO:
        out2 = ZERO
    return rate_4dp(out2)


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
    value = to_decimal(raw_value or 0)
    limit = Decimal('10000') if markup_type == MARKUP_TYPE_PERCENT else Decimal('10000000')
    if value < ZERO or value > limit:
        value = ZERO
    return markup_type, value


def get_purity_spot_config(cfg, metal, purity_label):
    """
    Per fineness: use_live + markup (percent over spot, or a fixed AED/g add-on).
    If the fineness is missing, fall back to use_home_spot_gold / use_home_spot_silver.
    """
    d = _purity_pricing_map(cfg, metal)
    p = (purity_label or '').strip()
    empty_markup_type, empty_markup_value = MARKUP_TYPE_PERCENT, ZERO
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
        'markup_pct': markup_value if markup_type == MARKUP_TYPE_PERCENT else ZERO,
    }


def resolve_effective_gram_sell_cridora(cfg, metal, purity):
    """
    Gold/silver only — stack:
      Cridora rate (ticker) = market spot X × (1 + admin margin Y%)
      Vendor Auto sell     = Cridora rate ± vendor markup Z (% or fixed AED/g)

    Manual mode uses the vendor gram map. Returns None to fall back to legacy metal rate.
    """
    if metal not in ('gold', 'silver'):
        return None
    from cridora.spot_prices import (
        get_spot_payload_public_margined,
        gold_rate_for_purity_tier,
        silver_rate_for_purity_tier,
    )

    conf = get_purity_spot_config(cfg, metal, purity)
    cridora = get_spot_payload_public_margined()
    gmap = get_metal_gram_map(cfg, metal)
    v_gram, _ = get_from_purity_map(gmap, purity)
    v_num = rate_4dp(v_gram) if v_gram is not None and v_gram > ZERO else None

    if conf['use_live']:
        if cridora:
            if metal == 'gold' and cridora.get('gold'):
                t = gold_rate_for_purity_tier(cridora['gold'], purity)
            elif metal == 'silver' and cridora.get('silver'):
                t = silver_rate_for_purity_tier(cridora['silver'], purity)
            else:
                t = None
            if t is not None and to_decimal(t) > ZERO:
                t_d = to_decimal(t)
                if conf['markup_type'] == MARKUP_TYPE_FIXED:
                    return rate_4dp(t_d + to_decimal(conf['markup_value']))
                mup = Decimal('1') + to_decimal(conf['markup_value']) / Decimal('100')
                return rate_4dp(t_d * mup)
        if v_num is not None:
            return v_num
        return None

    if v_num is not None:
        return v_num
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
            'markup_value': format(markup_value, 'f'),
            'markup_pct': format(markup_value, 'f') if markup_type == MARKUP_TYPE_PERCENT else '0',
        }
    return out
