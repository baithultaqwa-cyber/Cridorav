"""Historical commodity prices → indicative AED/g (marketing / tools only). Uses Gold API + platform USD/AED."""

import os
from datetime import date, timedelta
from urllib.parse import urlencode

import requests as http_requests
from django.core.cache import cache

from cridora.spot_prices import (
    GOLD_KARAT_PURITY,
    SILVER_FINENESS,
    TROY_OZ_TO_GRAMS,
    fetch_usd_to_aed,
)

# HG (copper futures style) quoted USD per pound on Gold API; convert to AED per gram fine.
HG_USD_PER_POUND_TO_GRAMS = 453.59237

SYMBOL_FOR_METAL = {"gold": "XAU", "silver": "XAG", "copper": "HG"}

_HISTORY_CACHE_PREFIX = "metal_history_v1:"
_HISTORY_CACHE_TTL = 86400  # 24h — history is stale-tolerant


def _get_gold_api_key():
    return (os.environ.get("GOLD_API_KEY") or "").strip()


def _default_purity_key(metal, purity_key):
    p = purity_key.strip() if isinstance(purity_key, str) and purity_key.strip() else ""
    if metal == "gold":
        return p or "24K"
    if metal == "silver":
        return p or "999"
    return p or "999"


def _parse_history_payload(obj):
    """Normalize Gold API history JSON into [(date_iso, close_usd), ...]."""
    rows = []

    def coalesce_date(d):
        if d is None:
            return None
        s = str(d).strip()
        if len(s) >= 10 and s[4] == "-" and s[7] == "-":
            return s[:10]
        return s

    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, (int, float)):
                continue
            if not isinstance(item, dict):
                continue
            ds = coalesce_date(
                item.get("date")
                or item.get("Date")
                or item.get("time")
                or item.get("timestamp")
            )
            px = (
                item.get("price")
                if item.get("price") is not None
                else item.get("close")
                if item.get("close") is not None
                else item.get("value")
            )
            if ds is not None and px is not None:
                try:
                    rows.append((ds, float(px)))
                except (TypeError, ValueError):
                    pass
        return sorted(rows, key=lambda x: x[0])

    if isinstance(obj, dict):
        for key in ("data", "history", "prices", "items", "rates"):
            if key in obj and isinstance(obj[key], list):
                return _parse_history_payload(obj[key])
        flat = []
        for k, v in obj.items():
            if isinstance(v, dict):
                dv = coalesce_date(v.get("date") or k)
                pv = v.get("price")
                if pv is None:
                    pv = v.get("close")
                if dv and pv is not None:
                    try:
                        flat.append((dv, float(pv)))
                    except (TypeError, ValueError):
                        pass
                continue
            if len(str(k)) >= 10 and str(k)[4] == "-":
                try:
                    flat.append((str(k)[:10], float(v)))
                except (TypeError, ValueError):
                    pass
        if flat:
            return sorted(flat, key=lambda x: x[0])
    return []


def _fetch_gold_api_history(symbol, start_iso, end_iso):
    api_key = _get_gold_api_key()
    if not api_key:
        return None, "missing_api_key"

    base = "https://api.gold-api.com/history/{symbol}".format(symbol=symbol)
    params = {"start": start_iso, "end": end_iso}
    url = f"{base}?{urlencode(params)}"

    try:
        r = http_requests.get(
            url,
            timeout=20,
            headers={
                "x-api-key": api_key,
                "User-Agent": "Mozilla/5.0 (compatible; Cridora/1.0)",
            },
        )
    except http_requests.RequestException:
        return None, "upstream_error"

    if r.status_code != 200:
        return None, f"upstream_status_{r.status_code}"

    try:
        parsed = _parse_history_payload(r.json())
    except (ValueError, TypeError):
        return None, "parse_error"

    if not parsed:
        return None, "empty_series"

    return parsed, None


def usd_benchmark_to_aed_per_gram_fine(symbol, usd_benchmark, usd_to_aed):
    if symbol == "HG":
        return (float(usd_benchmark) / HG_USD_PER_POUND_TO_GRAMS) * float(usd_to_aed)
    return (float(usd_benchmark) / TROY_OZ_TO_GRAMS) * float(usd_to_aed)


def _purity_multiplier(metal, purity_key):
    if metal == "gold":
        p = (purity_key or "24K").strip()
        if p in GOLD_KARAT_PURITY:
            return float(GOLD_KARAT_PURITY[p])
        pu = p.upper()
        return float(GOLD_KARAT_PURITY.get(pu, GOLD_KARAT_PURITY["24K"]))
    if metal == "silver":
        p = (purity_key or "999").strip()
        if p in SILVER_FINENESS:
            return float(SILVER_FINENESS[p])
        return float(SILVER_FINENESS.get(p, SILVER_FINENESS["999"]))
    if metal == "copper":
        p = (purity_key or "999").strip()
        try:
            if p.replace(".", "").isdigit() and float(p) <= 1000:
                return float(p) / 1000.0
        except (TypeError, ValueError):
            pass
        if p == "925":
            return 0.925
        return 1.0
    return 1.0


def get_metal_history_series(metal: str, purity_key: str, days: int):
    metal = (metal or "gold").lower().strip()
    if metal not in SYMBOL_FOR_METAL:
        metal = "gold"

    symbol = SYMBOL_FOR_METAL[metal]
    try:
        d = max(7, min(365, int(float(str(days).strip()))))
    except (TypeError, ValueError):
        d = 365

    purity_eff = _default_purity_key(metal, purity_key or "")
    cache_key = f"{_HISTORY_CACHE_PREFIX}{symbol}:{metal}:{purity_eff}:{d}"
    hit = cache.get(cache_key)
    if hit:
        return hit

    today = date.today()
    start = today - timedelta(days=d)
    start_iso = start.isoformat()
    end_iso = today.isoformat()

    raw_pairs, err = _fetch_gold_api_history(symbol, start_iso, end_iso)
    if raw_pairs is None:
        payload = {"error": err, "dates": [], "values": []}
        cache.set(cache_key, payload, timeout=300)
        return payload

    usd_to_aed, fx_src = fetch_usd_to_aed()
    mult = _purity_multiplier(metal, purity_eff)

    dates = []
    values = []

    for ds, px in raw_pairs:
        fine_aed_per_g = usd_benchmark_to_aed_per_gram_fine(symbol, px, usd_to_aed) * mult
        dates.append(ds)
        if metal == "silver":
            values.append(round(fine_aed_per_g, 3))
        elif metal == "gold":
            values.append(round(fine_aed_per_g, 2))
        else:
            values.append(round(fine_aed_per_g, 4))

    out = {
        "error": None,
        "currency": "AED",
        "unit": "per_gram",
        "metal": metal,
        "benchmark_symbol": symbol,
        "purity": purity_eff,
        "dates": dates,
        "values": values,
        "usd_to_aed": round(usd_to_aed, 6),
        "usd_to_aed_source": fx_src,
        "source": "gold_api_history",
        "disclaimer": (
            "Indicative only: derived from commodity benchmark closes converted with USD/AED. "
            "Not an executable quote; checkout always uses vendor prices on Cridora."
        ),
    }
    cache.set(cache_key, out, timeout=_HISTORY_CACHE_TTL)
    return out
