"""Public UAE gold rate comparison matrix (live scrapes + indicative channel estimates)."""
from datetime import datetime, timezone

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cridora.market_sources import (
    _derive_22k,
    estimate_from_spot,
    fetch_adcb_xau,
    fetch_arakkal_retail,
    fetch_cbd_xau,
    fetch_joyalukkas_ae,
    fetch_malabar_uae,
    fetch_mint_jewels,
    fetch_mks_pamp,
    fetch_sky_jewellery,
)
from cridora.spot_prices import (
    _apply_spot_display_margin,
    _build_spot_from_feed,
    _get_display_margin_pct,
    _stale_spot_or_platform_floor,
)

CACHE_KEY_MATRIX = "market_rate_matrix_v4"
CACHE_TTL_MATRIX = 90

# Channels without a public rate feed: indicative buy-side estimate vs Cridora spot.
# Markups reflect typical UAE digital-gold / bank spreads (not exact app prices).
CHANNEL_ROWS = (
    {
        "id": "adcb",
        "name": "ADCB Gold & Silver Account",
        "segment": "Bank · digital gold",
        "live_fetch": "adcb",
        "markup_pct": 2.0,
        "estimate_note": (
            "Estimated from global spot + ~2% typical bank digital-gold spread. "
            "Confirm in ADCB Mobile."
        ),
    },
    {
        "id": "cbd",
        "name": "CBD Gold & Silver Account",
        "segment": "Bank · digital gold",
        "live_fetch": "cbd",
        "markup_pct": 2.0,
        "estimate_note": (
            "CBD does not publish XAU on a public FX page (unlike ADCB). "
            "Estimated buy rate: spot + ~2%. Confirm in CBD Mobile."
        ),
    },
    {
        "id": "enbd",
        "name": "Emirates NBD Gold Account",
        "segment": "Bank · digital gold",
        "markup_pct": 2.0,
        "estimate_note": (
            "Estimated buy rate: global spot + ~2% typical bank spread. "
            "Live pricing is in ENBD X app only."
        ),
    },
    {
        "id": "mashreq",
        "name": "Mashreq Gold/Silver Edge",
        "segment": "Bank · digital gold",
        "markup_pct": 2.0,
        "estimate_note": (
            "Estimated buy rate: global spot + ~2% typical bank spread. "
            "Confirm in Mashreq Mobile."
        ),
    },
    {
        "id": "emoney",
        "name": "e& money (SafeGold)",
        "segment": "Fintech · digital gold",
        "markup_pct": 1.5,
        "estimate_note": (
            "Estimated buy rate: global spot + ~1.5% typical fintech vault spread. "
            "Confirm in e& money app."
        ),
    },
    {
        "id": "mgw",
        "name": "My Gold Wallet",
        "segment": "Fintech · digital gold",
        "live_fetch": "arakkal",
        "markup_pct": 1.5,
        "estimate_note": (
            "Estimated buy rate: global spot + ~1.5%. "
            "App uses Arakkal-backed live pricing (~30s refresh)."
        ),
    },
    {
        "id": "ogold",
        "name": "OGold Wallet",
        "segment": "Fintech · digital gold",
        "markup_pct": 1.8,
        "estimate_note": (
            "Estimated buy rate: global spot + ~1.8% typical refinery-linked spread. "
            "Confirm in OGold app."
        ),
    },
    {
        "id": "isa",
        "name": "ISA Bullion",
        "segment": "Bullion · physical trading",
        "markup_pct": 2.5,
        "estimate_note": (
            "Estimated retail desk buy rate: global spot + ~2.5%. "
            "Live oz/kg quotes on isabullion.com during market hours."
        ),
    },
)

# Live Dubai/UAE retail boards (scraped when market is open).
RETAIL_ROWS = (
    {
        "id": "mint_jewels",
        "name": "Mint Jewels (Dubai retail board)",
        "segment": "Retail · bullion & jewellery",
        "fetch": fetch_mint_jewels,
    },
    {
        "id": "malabar",
        "name": "Malabar Gold & Diamonds",
        "segment": "Retail · bullion & jewellery",
        "fetch": fetch_malabar_uae,
    },
    {
        "id": "sky_jewellery",
        "name": "Sky Jewellery",
        "segment": "Retail · Gold Souk & showrooms",
        "fetch": fetch_sky_jewellery,
    },
    {
        "id": "joyalukkas",
        "name": "Joyalukkas (UAE)",
        "segment": "Retail · bullion & jewellery",
        "fetch": fetch_joyalukkas_ae,
    },
)

_LIVE_FETCHERS = {
    "adcb": fetch_adcb_xau,
    "cbd": fetch_cbd_xau,
    "arakkal": fetch_arakkal_retail,
}


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


def _spot_payload():
    margin = _get_display_margin_pct()
    data = _build_spot_from_feed()
    if not data:
        data = _stale_spot_or_platform_floor()
    return _apply_spot_display_margin(data, margin)


def _apply_retail_fetch(retail_def):
    fetched = retail_def["fetch"]()
    if not fetched or not fetched.get("rate_24k"):
        return None
    return _row(
        retail_def["id"],
        retail_def["name"],
        retail_def["segment"],
        rate_24k=fetched["rate_24k"],
        rate_22k=fetched["rate_22k"],
        availability=fetched.get("availability") or "live",
        note=fetched.get("note") or "",
        source_url=fetched.get("source_url"),
    )


def _apply_live_fetch(channel, fetched):
    note = fetched.get("note") or channel.get("estimate_note") or ""
    return _row(
        channel["id"],
        channel["name"],
        channel["segment"],
        rate_24k=fetched.get("rate_24k"),
        rate_22k=fetched.get("rate_22k"),
        availability=fetched.get("availability") or "live",
        note=note,
        source_url=fetched.get("source_url"),
    )


def _apply_estimate(channel, spot_24k):
    estimated = estimate_from_spot(spot_24k, channel["markup_pct"])
    if not estimated:
        return _row(
            channel["id"],
            channel["name"],
            channel["segment"],
            availability="app_only",
            note=channel["estimate_note"],
        )
    return _row(
        channel["id"],
        channel["name"],
        channel["segment"],
        rate_24k=estimated["rate_24k"],
        rate_22k=estimated["rate_22k"],
        availability="indicative",
        note=channel["estimate_note"],
    )


def _build_channel_row(channel, spot_24k):
    fetch_key = channel.get("live_fetch")
    if fetch_key:
        fetcher = _LIVE_FETCHERS.get(fetch_key)
        if fetcher:
            fetched = fetcher()
            if fetched and fetched.get("rate_24k"):
                return _apply_live_fetch(channel, fetched)
    if spot_24k and channel.get("markup_pct") is not None:
        return _apply_estimate(channel, spot_24k)
    return _row(
        channel["id"],
        channel["name"],
        channel["segment"],
        availability="app_only",
        note=channel.get("estimate_note") or "Rate available in app only.",
    )


def _filter_rows_above_cridora(rows, cridora_ref):
    """Public page: always show Cridora; hide competitors at or below Cridora 24K."""
    if cridora_ref is None or float(cridora_ref) <= 0:
        return rows
    ref = float(cridora_ref)
    kept = []
    for row in rows:
        if row.get("is_cridora"):
            kept.append(row)
            continue
        r24 = row.get("rate_24k")
        if r24 is None:
            continue
        try:
            if float(r24) > ref:
                kept.append(row)
        except (TypeError, ValueError):
            continue
    return kept


def build_market_matrix():
    rows = []
    spot = _spot_payload()
    gold = spot.get("gold") if isinstance(spot.get("gold"), dict) else {}
    g24_spot = gold.get("24K")
    g22_spot = gold.get("22K")
    source = spot.get("source") or "unknown"

    cridora_ref = None
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

    if source == "stale_cache" and g24_spot:
        rows.append(
            _row(
                "global_spot",
                "Global spot (last saved)",
                "International benchmark",
                rate_24k=round(float(g24_spot), 2),
                rate_22k=round(float(g22_spot), 2) if g22_spot else None,
                availability="indicative",
                note=spot.get("note") or "Last saved spot — live feed temporarily unavailable.",
            )
        )

    mks = fetch_mks_pamp()
    if mks:
        rows.append(
            _row(
                "mks_pamp",
                "MKS PAMP GROUP desk",
                "Institutional · refinery trading",
                rate_24k=mks["rate_24k"],
                rate_22k=mks["rate_22k"],
                availability=mks["availability"],
                note=mks["note"],
                source_url=mks.get("source_url"),
            )
        )

    for retail in RETAIL_ROWS:
        retail_row = _apply_retail_fetch(retail)
        if retail_row:
            rows.append(retail_row)

    spot_ref = cridora_ref if cridora_ref and cridora_ref > 0 else None
    for channel in CHANNEL_ROWS:
        rows.append(_build_channel_row(channel, spot_ref))

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

    rows = _filter_rows_above_cridora(rows, cridora_ref)

    return {
        "currency": "AED",
        "unit": "per_gram",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cridora_reference_24k": cridora_ref,
        "spot_source": source,
        "disclaimer": (
            "Indicative comparison only. Only channels priced above Cridora's reference "
            "24K rate are shown. Retail boards include Mint Jewels, Malabar, Sky Jewellery "
            "when live. Joyalukkas UAE rates load in-app only (no stable public scrape). "
            "Cridora checkout uses your vendor quote."
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
