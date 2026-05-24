"""Public UAE gold rate comparison matrix (best-effort live + labelled static rows)."""
import re
from datetime import datetime, timezone

import requests as http_requests
from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cridora.retail_rates import (
    CACHE_KEY_RETAIL,
    CACHE_TTL_RETAIL,
    _fetch_mint_jewels_html,
    parse_mint_jewels_html,
)
from cridora.spot_prices import (
    TROY_OZ_TO_GRAMS,
    _apply_spot_display_margin,
    _build_spot_from_feed,
    _get_display_margin_pct,
    _stale_spot_or_platform_floor,
    fetch_usd_to_aed,
)

CACHE_KEY_MATRIX = "market_rate_matrix_v1"
CACHE_TTL_MATRIX = 90

MKS_PAMP_URL = "https://live.mkspamp.com/MKSPricing/prices.xhtml"
KARAT_22_RATIO = 0.9167
DEFAULT_USD_AED = 3.6725

STATIC_APP_ROWS = (
    {
        "id": "enbd",
        "name": "Emirates NBD Gold Account",
        "segment": "Bank · digital gold",
        "availability": "app_only",
        "note": "Live buy/sell in ENBD X app only — no public API.",
    },
    {
        "id": "adcb",
        "name": "ADCB Gold & Silver Account",
        "segment": "Bank · digital gold",
        "availability": "app_only",
        "note": "App pricing; public FX page updates about once daily.",
    },
    {
        "id": "mashreq",
        "name": "Mashreq Gold/Silver Edge",
        "segment": "Bank · digital gold",
        "availability": "app_only",
        "note": "Unit price adjusted twice daily in Mashreq Mobile.",
    },
    {
        "id": "emoney",
        "name": "e& money (SafeGold)",
        "segment": "Fintech · digital gold",
        "availability": "app_only",
        "note": "24K vault gold from AED 10 — rates inside e& money app.",
    },
    {
        "id": "mgw",
        "name": "My Gold Wallet",
        "segment": "Fintech · digital gold",
        "availability": "app_only",
        "note": "Arakkal-backed; live rate in app (~30s refresh).",
    },
    {
        "id": "ogold",
        "name": "OGold Wallet",
        "segment": "Fintech · digital gold",
        "availability": "app_only",
        "note": "Real-time buy/sell in OGold app.",
    },
    {
        "id": "isa",
        "name": "ISA Bullion",
        "segment": "Bullion · physical trading",
        "availability": "app_only",
        "note": "Live oz/kg desk on isabullion.com during market hours.",
    },
)


def _row(
    row_id,
    name,
    segment,
    rate_24k=None,
    rate_22k=None,
    availability="live",
    note="",
    source_url=None,
    is_cridora=False,
):
    out = {
        "id": row_id,
        "name": name,
        "segment": segment,
        "rate_24k": rate_24k,
        "rate_22k": rate_22k,
        "availability": availability,
        "note": note,
        "is_cridora": is_cridora,
    }
    if source_url:
        out["source_url"] = source_url
    return out


def _derive_22k(rate_24k):
    if rate_24k is None:
        return None
    try:
        return round(float(rate_24k) * KARAT_22_RATIO, 2)
    except (TypeError, ValueError):
        return None


def _usd_oz_to_aed_gram(usd_per_oz, usd_aed):
    return round((float(usd_per_oz) / TROY_OZ_TO_GRAMS) * float(usd_aed), 2)


def _fetch_mks_pamp_xau_usd_sell():
    """Parse MKS PAMP public desk XAU/USD sell (mid wholesale reference)."""
    try:
        resp = http_requests.get(
            MKS_PAMP_URL,
            timeout=10,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; Cridora/1.0; market matrix)",
                "Accept": "text/html",
            },
        )
    except http_requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    html = resp.text or ""
    m = re.search(
        r"XAU/USD\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)",
        html,
        re.IGNORECASE,
    )
    if not m:
        m = re.search(
            r"\|\s*XAU/USD\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)",
            html,
        )
    if not m:
        return None
    try:
        sell = float(m.group(2))
        if sell <= 0:
            return None
        return sell
    except ValueError:
        return None


def _spot_payload():
    margin = _get_display_margin_pct()
    data = _build_spot_from_feed()
    if not data:
        data = _stale_spot_or_platform_floor()
    return _apply_spot_display_margin(data, margin)


def _mint_retail_gold():
    cached = cache.get(CACHE_KEY_RETAIL)
    if cached and cached.get("gold"):
        return cached.get("gold"), cached.get("source_url")
    try:
        resp = _fetch_mint_jewels_html()
    except http_requests.RequestException:
        return {}, None
    if resp.status_code != 200:
        return {}, None
    gold, silver = parse_mint_jewels_html(resp.text or "")
    if not gold:
        return {}, None
    payload = {
        "currency": "AED",
        "unit": "per_gram",
        "source": "mintjewels",
        "source_url": "https://mintjewels.ae/live-gold-price-dubai/",
        "source_label": "Indicative Dubai retail board (AED/g)",
        "gold": gold,
        "silver": silver,
    }
    cache.set(CACHE_KEY_RETAIL, payload, timeout=CACHE_TTL_RETAIL)
    return gold, payload["source_url"]


def build_market_matrix():
    rows = []
    spot = _spot_payload()
    gold = spot.get("gold") if isinstance(spot.get("gold"), dict) else {}
    g24_spot = gold.get("24K")
    g22_spot = gold.get("22K")
    source = spot.get("source") or "unknown"

    cridora_ref = None
    cridora_row_added = False
    if g24_spot is not None and float(g24_spot) > 0:
        cridora_ref = float(g24_spot)
        if source == "platform_floor":
            cridora_label = "Cridora Marketplace"
            cridora_segment = "Verified vendor listings"
            cridora_note = (
                "Lowest all-in AED/g from current KYB-verified marketplace listings."
            )
        else:
            cridora_label = "Cridora reference ticker"
            cridora_segment = "Platform spot display"
            cridora_note = (
                "Same indicative global spot feed as the header ticker — "
                "checkout uses each vendor's quoted price."
            )
        rows.append(
            _row(
                "cridora",
                cridora_label,
                cridora_segment,
                rate_24k=round(float(g24_spot), 2),
                rate_22k=round(float(g22_spot), 2) if g22_spot else _derive_22k(g24_spot),
                availability="live" if source in ("spot", "platform_floor") else "indicative",
                note=cridora_note,
                is_cridora=True,
            )
        )
        cridora_row_added = True
    else:
        rows.append(
            _row(
                "cridora",
                "Cridora Marketplace",
                "Verified vendor listings",
                availability="live",
                note=(
                    "Compare live quotes from KYB-verified UAE vendors on the marketplace — "
                    "your order price is always the vendor's disclosed quote."
                ),
                is_cridora=True,
            )
        )
        cridora_row_added = True

    if source == "spot" and g24_spot and not cridora_row_added:
        rows.append(
            _row(
                "global_spot",
                "Global spot (XAU / XAG feed)",
                "International benchmark",
                rate_24k=round(float(g24_spot), 2),
                rate_22k=round(float(g22_spot), 2) if g22_spot else _derive_22k(g24_spot),
                availability="live",
                note="Converted from live XAU USD/oz with USD→AED FX.",
            )
        )
    elif source == "stale_cache":
        rows.append(
            _row(
                "global_spot",
                "Global spot (last saved)",
                "International benchmark",
                rate_24k=round(float(g24_spot), 2) if g24_spot else None,
                rate_22k=round(float(g22_spot), 2) if g22_spot else _derive_22k(g24_spot),
                availability="indicative",
                note=spot.get("note") or "Last saved spot — live feed temporarily unavailable.",
            )
        )

    usd_aed, _fx_src = fetch_usd_to_aed()
    xau_sell_usd = _fetch_mks_pamp_xau_usd_sell()
    if xau_sell_usd:
        inst_24 = _usd_oz_to_aed_gram(xau_sell_usd, usd_aed or DEFAULT_USD_AED)
        rows.append(
            _row(
                "mks_pamp",
                "MKS PAMP GROUP desk",
                "Institutional · refinery trading",
                rate_24k=inst_24,
                rate_22k=_derive_22k(inst_24),
                availability="live",
                note="Public WE SELL XAU/USD desk rate converted to AED/g (wholesale).",
                source_url=MKS_PAMP_URL,
            )
        )

    mint_gold, mint_url = _mint_retail_gold()
    if mint_gold.get("24K"):
        rows.append(
            _row(
                "mint_jewels",
                "Mint Jewels (Dubai retail board)",
                "Retail · bullion & jewellery",
                rate_24k=round(float(mint_gold["24K"]), 2),
                rate_22k=(
                    round(float(mint_gold["22K"]), 2)
                    if mint_gold.get("22K")
                    else _derive_22k(mint_gold["24K"])
                ),
                availability="live",
                note="Public Dubai retail board — shop invoice may add making charges & VAT.",
                source_url=mint_url,
            )
        )

    for static in STATIC_APP_ROWS:
        rows.append(
            _row(
                static["id"],
                static["name"],
                static["segment"],
                availability=static["availability"],
                note=static["note"],
            )
        )

    if cridora_ref and cridora_ref > 0:
        for row in rows:
            r24 = row.get("rate_24k")
            if r24 is None or row.get("is_cridora"):
                row["delta_vs_cridora_aed"] = None
                row["delta_vs_cridora_pct"] = None
                continue
            try:
                delta = round(float(r24) - cridora_ref, 2)
                pct = round((delta / cridora_ref) * 100, 2)
                row["delta_vs_cridora_aed"] = delta
                row["delta_vs_cridora_pct"] = pct
            except (TypeError, ValueError, ZeroDivisionError):
                row["delta_vs_cridora_aed"] = None
                row["delta_vs_cridora_pct"] = None

    return {
        "currency": "AED",
        "unit": "per_gram",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cridora_reference_24k": cridora_ref,
        "spot_source": source,
        "disclaimer": (
            "Indicative comparison only. Bank and fintech app rates require in-app login. "
            "Cridora checkout always uses the verified vendor quote on your order."
        ),
        "rows": rows,
    }


class MarketRateMatrixView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get(CACHE_KEY_MATRIX)
        if cached:
            return Response(cached)
        data = build_market_matrix()
        cache.set(CACHE_KEY_MATRIX, data, timeout=CACHE_TTL_MATRIX)
        return Response(data)
