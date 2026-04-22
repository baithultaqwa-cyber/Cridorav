"""Global spot metal prices (AED/g) — external feed with platform-listing fallback."""
import threading
import copy

import requests as http_requests
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

TROY_OZ_TO_GRAMS = 31.1035

GOLD_KARAT_PURITY = {
    "24K": 1.0,
    "22K": 0.9167,
    "21K": 0.8750,
    "18K": 0.7500,
}

SILVER_FINENESS = {
    "999": 1.0,
    "925": 0.925,
}

_CACHE_KEY_SPOT = "spot_prices_external"
# Short TTL so ticker/dashboards can refresh near–real-time without stale server cache.
_CACHE_TTL = 30
_CACHE_KEY_LAST_GOOD = "spot_prices_last_good_global"
_CACHE_TTL_LAST_GOOD = 86400 * 7  # keep last successful global spot one week for fallback

DEFAULT_USD_AED = 3.6725
CACHE_KEY_USD_AED = "fx_usd_aed_frankfurter"
CACHE_TTL_USD_AED = 3600

# Prevents re-entrancy: platform floor listing scan calls final_rate -> effective -> home spot -> get raw -> floor
_tls = threading.local()


def _in_platform_floor_scan():
    return getattr(_tls, "platform_floor", False)


def set_platform_floor_context(active: bool):
    _tls.platform_floor = active


def fetch_usd_to_aed():
    """Live USD→AED from Frankfurter; falls back to UAE peg if unreachable."""
    cached = cache.get(CACHE_KEY_USD_AED)
    if cached is not None:
        try:
            v = float(cached)
            if v > 0:
                return v, "cached"
        except (TypeError, ValueError):
            pass

    try:
        r = http_requests.get(
            "https://api.frankfurter.app/latest?from=USD&to=AED",
            timeout=6,
            headers={"User-Agent": "Mozilla/5.0 (compatible; Cridora/1.0)"},
        )
        if r.status_code != 200:
            return DEFAULT_USD_AED, "peg_fallback"
        data = r.json()
        rate = float(data["rates"]["AED"])
        if rate <= 0 or rate > 10:
            return DEFAULT_USD_AED, "peg_fallback"
        cache.set(CACHE_KEY_USD_AED, rate, timeout=CACHE_TTL_USD_AED)
        return rate, "frankfurter"
    except (http_requests.RequestException, KeyError, ValueError, TypeError):
        return DEFAULT_USD_AED, "peg_fallback"


def _build_spot_from_feed():
    try:
        gold_resp = http_requests.get(
            "https://api.gold-api.com/price/XAU", timeout=8
        )
        silver_resp = http_requests.get(
            "https://api.gold-api.com/price/XAG", timeout=8
        )
    except http_requests.RequestException:
        return None

    if gold_resp.status_code != 200 or silver_resp.status_code != 200:
        return None

    try:
        gold_usd_per_oz = gold_resp.json()["price"]
        silver_usd_per_oz = silver_resp.json()["price"]
    except (KeyError, ValueError, TypeError):
        return None

    usd_to_aed, fx_source = fetch_usd_to_aed()
    gold_per_gram_aed = (float(gold_usd_per_oz) / TROY_OZ_TO_GRAMS) * usd_to_aed
    silver_per_gram_aed = (float(silver_usd_per_oz) / TROY_OZ_TO_GRAMS) * usd_to_aed

    return {
        "currency": "AED",
        "unit": "per_gram",
        "source": "spot",
        "usd_to_aed": round(usd_to_aed, 6),
        "usd_to_aed_source": fx_source,
        "gold": {
            karat: round(gold_per_gram_aed * purity, 2)
            for karat, purity in GOLD_KARAT_PURITY.items()
        },
        "silver": {
            fineness: round(silver_per_gram_aed * purity, 3)
            for fineness, purity in SILVER_FINENESS.items()
        },
    }


def _platform_floor_payload():
    """Lowest all-in AED/g (final_rate_per_gram) per metal across visible in-stock catalog."""
    from users.models import CatalogProduct, User

    set_platform_floor_context(True)
    try:
        qs = (
            CatalogProduct.objects.filter(visible=True, in_stock=True)
            .exclude(vendor__kyc_status=User.KYC_REJECTED)
            .select_related("vendor", "vendor__pricing_config")
        )

        mins = {"gold": None, "silver": None, "platinum": None, "palladium": None}
        for p in qs:
            r = p.final_rate_per_gram()
            if r is None or r <= 0:
                continue
            m = p.metal
            if m not in mins:
                continue
            if mins[m] is None or r < mins[m]:
                mins[m] = float(r)

        ticker_items = []
        labels = {
            "gold": "Gold (lowest listing)",
            "silver": "Silver (lowest listing)",
            "platinum": "Platinum (lowest listing)",
            "palladium": "Palladium (lowest listing)",
        }
        for metal, label in labels.items():
            v = mins.get(metal)
            if v is not None and v > 0:
                ticker_items.append({"label": label, "value": round(v, 4)})

        if not ticker_items:
            ticker_items = [
                {"label": "Marketplace", "text": "No published metal products yet."},
            ]

        gold_base = mins.get("gold") or 0
        silver_base = mins.get("silver") or 0

        gold_dict = (
            {k: round(gold_base * p, 2) for k, p in GOLD_KARAT_PURITY.items()}
            if gold_base > 0
            else {k: 0.0 for k in GOLD_KARAT_PURITY}
        )
        silver_dict = (
            {k: round(silver_base * p, 3) for k, p in SILVER_FINENESS.items()}
            if silver_base > 0
            else {k: 0.0 for k in SILVER_FINENESS}
        )

        return {
            "currency": "AED",
            "unit": "per_gram",
            "source": "platform_floor",
            "note": "Lowest all-in AED/g from current marketplace listings (external spot feed unavailable).",
            "ticker_items": ticker_items,
            "gold": gold_dict,
            "silver": silver_dict,
        }
    finally:
        set_platform_floor_context(False)


def _stale_spot_or_platform_floor():
    """When the external feed fails, return last successful global spot if we have it."""
    stale = cache.get(_CACHE_KEY_LAST_GOOD)
    if stale and stale.get("gold") and stale.get("silver"):
        out = {**stale, "source": "stale_cache"}
        out["note"] = (
            "Last saved global spot (live feed temporarily unavailable). "
            "Rates refresh when the feed is reachable."
        )
        return out
    return _platform_floor_payload()


def _get_display_margin_pct():
    from users.models import PlatformConfig
    try:
        return float(PlatformConfig.get().home_spot_display_margin_pct)
    except (TypeError, ValueError, AttributeError):
        return 0.0


def _apply_spot_display_margin(data, margin_pct):
    """Scales public numeric ticker values. Does not mutate input."""
    if not margin_pct or float(margin_pct) == 0:
        return data
    m = 1.0 + float(margin_pct) / 100.0
    out = copy.deepcopy(data)
    for key in ("gold", "silver"):
        block = out.get(key)
        if isinstance(block, dict):
            for k, v in block.items():
                if isinstance(v, (int, float)):
                    out[key][k] = round(float(v) * m, 4)
    tix = out.get("ticker_items")
    if isinstance(tix, list):
        out["ticker_items"] = []
        for item in tix:
            it = {**item}
            if "value" in it and it["value"] is not None and isinstance(it["value"], (int, float)):
                it["value"] = round(float(it["value"]) * m, 4)
            out["ticker_items"].append(it)
    return out


def get_spot_payload_raw_unmarginated():
    """
    Same underlying numbers vendors use for “home spot” alignment (not the admin display margin).
    Re-entrancy: returns None when called from inside the platform floor listing scan to avoid cycles.
    """
    if _in_platform_floor_scan():
        return None

    cached = cache.get(_CACHE_KEY_SPOT)
    if cached and cached.get("gold") and cached.get("silver"):
        return cached

    data = _build_spot_from_feed()
    if data:
        cache.set(_CACHE_KEY_SPOT, data, timeout=_CACHE_TTL)
        cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
        return data

    stale = cache.get(_CACHE_KEY_LAST_GOOD)
    if stale and stale.get("gold") and stale.get("silver"):
        return stale
    return None


def gold_rate_for_purity_tier(gold_block, purity):
    if not gold_block or not isinstance(gold_block, dict):
        return None
    p = (purity or "24K").strip()
    if p in gold_block:
        return float(gold_block[p])
    pu = p.upper()
    if pu in gold_block:
        return float(gold_block[pu])
    try:
        if p.replace(".", "").replace(" ", "").isdigit() and float(p) <= 1000:
            fin = float(p) / 1000.0
            return float(gold_block.get("24K", 0) or 0) * fin
    except (TypeError, ValueError):
        pass
    return float(gold_block.get("24K", 0) or 0)


def silver_rate_for_purity_tier(silver_block, purity):
    if not silver_block or not isinstance(silver_block, dict):
        return None
    p = (purity or "999").strip()
    if p in silver_block:
        return float(silver_block[p])
    try:
        if p.replace(".", "").replace(" ", "").isdigit() and float(p) <= 1000:
            fin = float(p) / 1000.0
            return float(silver_block.get("999", 0) or 0) * fin
    except (TypeError, ValueError):
        pass
    return float(silver_block.get("999", 0) or 0)


def live_effective_rate_from_home_spot(product, cfg):
    """
    If the vendor uses home-page spot for gold/silver, return the AED/g rate for this product
    (matches global spot / stale cache tiering, not the public display margin).
    """
    if _in_platform_floor_scan():
        return None
    if not product.use_live_rate:
        return None
    raw = get_spot_payload_raw_unmarginated()
    if not raw or not raw.get("gold") or not raw.get("silver"):
        return None
    if product.metal == "gold" and getattr(cfg, "use_home_spot_gold", False):
        v = gold_rate_for_purity_tier(raw["gold"], product.purity)
        return v if v and v > 0 else None
    if product.metal == "silver" and getattr(cfg, "use_home_spot_silver", False):
        v = silver_rate_for_purity_tier(raw["silver"], product.purity)
        return v if v and v > 0 else None
    return None


# Backward-compatible names
CACHE_KEY_SPOT = _CACHE_KEY_SPOT
CACHE_TTL = _CACHE_TTL
CACHE_KEY_LAST_GOOD = _CACHE_KEY_LAST_GOOD
CACHE_TTL_LAST_GOOD = _CACHE_TTL_LAST_GOOD


class SpotPriceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        margin = _get_display_margin_pct()
        cached = cache.get(_CACHE_KEY_SPOT)
        if cached:
            return Response(_apply_spot_display_margin(cached, margin))

        data = _build_spot_from_feed()
        if data is None:
            return Response(
                _apply_spot_display_margin(_stale_spot_or_platform_floor(), margin)
            )

        cache.set(_CACHE_KEY_SPOT, data, timeout=_CACHE_TTL)
        cache.set(_CACHE_KEY_LAST_GOOD, data, timeout=_CACHE_TTL_LAST_GOOD)
        return Response(_apply_spot_display_margin(data, margin))
