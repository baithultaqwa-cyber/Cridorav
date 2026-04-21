"""Dubai retail precious-metal board rates from public dealer pages (best-effort HTML parse)."""
import re
import requests as http_requests
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

MINT_JEWELS_LIVE_URL = "https://mintjewels.ae/live-gold-price-dubai/"
CACHE_KEY_RETAIL = "dubai_retail_mint_jewels"
CACHE_TTL_RETAIL = 120

GOLD_KARATS = ("24K", "22K", "21K", "18K")
SILVER_FINENESS = ("999", "925")


def _parse_aed_after_label(html: str, label_pattern: str):
    """Find first AED price after a label (handles markup noise between label and price)."""
    m = re.search(
        label_pattern + r"[^0-9]{0,800}?AED\s*([\d,]+\.?\d*)",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def parse_mint_jewels_html(html: str):
    """Extract AED/g gold and silver board rates from Mint Jewels live page HTML."""
    gold = {}
    silver = {}
    for karat in GOLD_KARATS:
        v = _parse_aed_after_label(html, rf"Gold\s*{re.escape(karat)}")
        if v is not None and v > 0:
            gold[karat] = round(v, 2)
    for fin in SILVER_FINENESS:
        v = _parse_aed_after_label(html, rf"Silver\s*{re.escape(fin)}")
        if v is not None and v > 0:
            silver[fin] = round(v, 3)
    return gold, silver


def _fetch_mint_jewels_html():
    r = http_requests.get(
        MINT_JEWELS_LIVE_URL,
        timeout=12,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; Cridora/1.0; +retail rates reference)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    return r


class DubaiRetailRatesView(APIView):
    """Public UAE retail-style board rates (third-party page; indicative)."""

    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get(CACHE_KEY_RETAIL)
        if cached:
            return Response(cached)

        try:
            resp = _fetch_mint_jewels_html()
        except http_requests.RequestException:
            return Response(_error_payload("Could not reach the retail source."))

        if resp.status_code != 200:
            return Response(
                _error_payload(f"Retail source returned HTTP {resp.status_code}.")
            )

        html = resp.text or ""
        gold, silver = parse_mint_jewels_html(html)
        if not gold and not silver:
            return Response(
                _error_payload(
                    "Could not parse retail rates (page layout may have changed)."
                )
            )

        data = {
            "currency": "AED",
            "unit": "per_gram",
            "source": "mintjewels",
            "source_url": MINT_JEWELS_LIVE_URL,
            "source_label": "Indicative Dubai retail board (AED/g)",
            "gold": gold,
            "silver": silver,
        }
        cache.set(CACHE_KEY_RETAIL, data, timeout=CACHE_TTL_RETAIL)
        return Response(data)


def _error_payload(note: str):
    return {
        "currency": "AED",
        "unit": "per_gram",
        "source": "unavailable",
        "source_url": None,
        "source_label": "Retail reference unavailable",
        "gold": {},
        "silver": {},
        "error": note,
    }
