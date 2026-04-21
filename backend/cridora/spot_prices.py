"""Global spot metal prices (AED/g) — external feed with platform-listing fallback."""
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

CACHE_KEY_SPOT = "spot_prices_external"
CACHE_TTL = 600
CACHE_KEY_LAST_GOOD = "spot_prices_last_good_global"
CACHE_TTL_LAST_GOOD = 86400 * 7  # keep last successful global spot one week for fallback

DEFAULT_USD_AED = 3.6725
CACHE_KEY_USD_AED = "fx_usd_aed_frankfurter"
CACHE_TTL_USD_AED = 3600


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


def _platform_floor_payload():
    """Lowest all-in AED/g (final_rate_per_gram) per metal across visible in-stock catalog."""
    from users.models import CatalogProduct, User

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


def _stale_spot_or_platform_floor():
    """When the external feed fails, return last successful global spot if we have it."""
    stale = cache.get(CACHE_KEY_LAST_GOOD)
    if stale and stale.get("gold") and stale.get("silver"):
        out = {**stale, "source": "stale_cache"}
        out["note"] = (
            "Last saved global spot (live feed temporarily unavailable). "
            "Rates refresh when the feed is reachable."
        )
        return out
    return _platform_floor_payload()


class SpotPriceView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get(CACHE_KEY_SPOT)
        if cached:
            return Response(cached)

        try:
            gold_resp = http_requests.get(
                "https://api.gold-api.com/price/XAU", timeout=8
            )
            silver_resp = http_requests.get(
                "https://api.gold-api.com/price/XAG", timeout=8
            )
        except http_requests.RequestException:
            return Response(_stale_spot_or_platform_floor())

        if gold_resp.status_code != 200 or silver_resp.status_code != 200:
            return Response(_stale_spot_or_platform_floor())

        try:
            gold_usd_per_oz = gold_resp.json()["price"]
            silver_usd_per_oz = silver_resp.json()["price"]
        except (KeyError, ValueError, TypeError):
            return Response(_stale_spot_or_platform_floor())

        usd_to_aed, fx_source = fetch_usd_to_aed()

        gold_per_gram_aed = (gold_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_to_aed
        silver_per_gram_aed = (silver_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_to_aed

        data = {
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

        cache.set(CACHE_KEY_SPOT, data, timeout=CACHE_TTL)
        cache.set(CACHE_KEY_LAST_GOOD, data, timeout=CACHE_TTL_LAST_GOOD)
        return Response(data)
