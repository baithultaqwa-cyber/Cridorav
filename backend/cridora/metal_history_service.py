"""Historical commodity prices → indicative AED/g (marketing / tools).

Gold & silver: bundled daily USD benchmarks (~1 year of rows) merged with UTC-daily ticker
snapshots (display-margined AED/g from ``/api/spot-prices/``). Optional intra-day filler for
today if no snapshot row exists yet. Copper continues to use Gold API ``GOLD_API_KEY`` history.
"""

import os
from datetime import date, timedelta
from urllib.parse import urlencode

import requests as http_requests
from django.core.cache import cache

from cridora.metal_benchmark_csv import benchmark_rows_between
from cridora.metal_snapshot import list_snapshots_between
from cridora.spot_prices import (
    GOLD_KARAT_PURITY,
    SILVER_FINENESS,
    TROY_OZ_TO_GRAMS,
    fetch_usd_to_aed,
    get_home_spot_display_margin_pct,
    get_spot_payload_public_margined,
    gold_rate_for_purity_tier,
    silver_rate_for_purity_tier,
)

HG_USD_PER_POUND_TO_GRAMS = 453.59237
SYMBOL_FOR_METAL = {"gold": "XAU", "silver": "XAG", "copper": "HG"}

_HISTORY_CACHE_PREFIX = "metal_history_v4:"
_HISTORY_CACHE_TTL = 86400


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


def _round_hist_value(metal, v):
    if metal == "silver":
        return round(v, 3)
    if metal == "gold":
        return round(v, 2)
    return round(v, 4)


def _csv_point_aed(symbol, metal, purity_eff, px_usd, usd_to_aed):
    mult = _purity_multiplier(metal, purity_eff)
    try:
        from cridora.pricing_engine import wallet_markup_pct
        m = float(wallet_markup_pct(metal))
    except Exception:
        m = float(get_home_spot_display_margin_pct())
    scale = (1.0 + m / 100.0) if m else 1.0
    base = usd_benchmark_to_aed_per_gram_fine(symbol, px_usd, usd_to_aed) * mult
    scaled = base * scale
    return _round_hist_value(metal, scaled)


def _snap_point_aed(metal, purity_eff, snap):
    if metal == "gold" and snap.gold_24k_aed_per_gram is not None:
        fg = float(snap.gold_24k_aed_per_gram)
        mult = _purity_multiplier(metal, purity_eff)
        return _round_hist_value(metal, fg * mult)
    if metal == "silver" and snap.silver_999_aed_per_gram is not None:
        sg = float(snap.silver_999_aed_per_gram)
        mult = _purity_multiplier(metal, purity_eff)
        return _round_hist_value(metal, sg * mult)
    return None


def _merge_gold_silver_series(metal, purity_eff, symbol, today, start, end, usd_to_aed):
    """Build dates/values/kinds merged map; overlays snapshots on CSV overlaps."""
    start_iso = start.isoformat()
    end_iso = end.isoformat()
    merged = {}

    for ds, px_usd in benchmark_rows_between(metal, start_iso, end_iso):
        ae = _csv_point_aed(symbol, metal, purity_eff, px_usd, usd_to_aed)
        if ae > 0:
            merged[ds] = ("csv", ae)

    for snap in list_snapshots_between(start, end):
        ds = snap.snapshot_date.isoformat()
        if ds < start_iso or ds > end_iso:
            continue
        ae = _snap_point_aed(metal, purity_eff, snap)
        if ae is not None and ae > 0:
            merged[ds] = ("snap", ae)

    today_iso = today.isoformat()
    if (
        start_iso <= today_iso <= end_iso
        and today_iso not in merged
    ):
        live = get_spot_payload_public_margined()
        if live:
            if metal == "gold":
                ae = gold_rate_for_purity_tier(live.get("gold"), purity_eff)
            else:
                ae = silver_rate_for_purity_tier(live.get("silver"), purity_eff)
            if ae is not None and ae > 0:
                merged[today_iso] = ("live", _round_hist_value(metal, float(ae)))

    dates_sorted = sorted(merged.keys())
    values = [merged[d][1] for d in dates_sorted]
    kinds = [merged[d][0] for d in dates_sorted]

    bench_note = (
        "Silver references bundled SI=F futures daily closes USD/troy oz "
        "(Yahoo-export style). Gold references bundled COMEX-active futures daily USD/troy oz "
        "(Yahoo GC=F-range export). AED/g merges UTC-daily ticker snapshots so recent points "
        "match displayed rates; CSV-derived legs use today's USD/AED and display margin."
    )

    disclaimer = (
        "Indicative only: futures/active-month benchmarks in USD/troy ounce, converted with USD/AED. "
        "CSV legs apply the platform display margin uniformly; snapshot/live legs match ticker output. "
        "Not an executable quote; checkout uses vendor prices on Cridora."
    )

    return (
        dates_sorted,
        values,
        kinds,
        bench_note,
        disclaimer,
    )


def get_metal_history_series(metal: str, purity_key: str, days: int):
    metal = (metal or "gold").lower().strip()
    if metal not in SYMBOL_FOR_METAL:
        metal = "gold"

    symbol = SYMBOL_FOR_METAL[metal]
    try:
        d_req = max(7, min(365, int(float(str(days).strip()))))
    except (TypeError, ValueError):
        d_req = 365

    purity_eff = _default_purity_key(metal, purity_key or "")
    cache_key = f"{_HISTORY_CACHE_PREFIX}{symbol}:{metal}:{purity_eff}:{d_req}"
    hit = cache.get(cache_key)
    if hit:
        return hit

    today = date.today()
    start = today - timedelta(days=d_req)
    end = today
    start_iso = start.isoformat()

    usd_to_aed, fx_src = fetch_usd_to_aed()

    if metal == "copper":
        raw_pairs, err = _fetch_gold_api_history(symbol, start_iso, today.isoformat())
        if raw_pairs is None:
            payload = {"error": err, "dates": [], "values": []}
            cache.set(cache_key, payload, timeout=300)
            return payload

        mult = _purity_multiplier(metal, purity_eff)
        dates = []
        values = []
        kinds = []

        for ds, px in raw_pairs:
            fine_aed_per_g = (
                usd_benchmark_to_aed_per_gram_fine(symbol, px, usd_to_aed) * mult
            )
            dates.append(ds)
            values.append(_round_hist_value("copper", fine_aed_per_g))
            kinds.append("gold_api_history")

        payload = {
            "error": None,
            "currency": "AED",
            "unit": "per_gram",
            "metal": metal,
            "benchmark_symbol": symbol,
            "purity": purity_eff,
            "dates": dates,
            "values": values,
            "point_sources": kinds,
            "usd_to_aed": round(usd_to_aed, 6),
            "usd_to_aed_source": fx_src,
            "source": "gold_api_history",
            "disclaimer": (
                "Indicative only: derived from HG benchmark via Gold API, converted with USD/AED."
                " Requires GOLD_API_KEY for copper history."
            ),
        }
        cache.set(cache_key, payload, timeout=_HISTORY_CACHE_TTL)
        return payload

    ds_list, vals, kinds, bench_note, disclaimer = _merge_gold_silver_series(
        metal, purity_eff, symbol, today, start, end, usd_to_aed
    )

    if not ds_list:
        payload = {"error": "empty_series_csv_or_snapshots", "dates": [], "values": []}
        cache.set(cache_key, payload, timeout=300)
        return payload

    payload = {
        "error": None,
        "currency": "AED",
        "unit": "per_gram",
        "metal": metal,
        "benchmark_symbol": symbol,
        "purity": purity_eff,
        "dates": ds_list,
        "values": vals,
        "point_sources": kinds,
        "usd_to_aed": round(usd_to_aed, 6),
        "usd_to_aed_source": fx_src,
        "source": "csv_benchmark_plus_ticker_snapshots",
        "benchmark_note": bench_note,
        "disclaimer": disclaimer,
    }
    cache.set(cache_key, payload, timeout=_HISTORY_CACHE_TTL)
    return payload
