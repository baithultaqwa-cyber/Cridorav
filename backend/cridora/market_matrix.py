"""Public UAE gold rate comparison matrix — scraped rates only, with last-good fallback."""
from datetime import datetime, timezone

from django.core.cache import cache
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cridora.market_sources import (
    _derive_22k,
    _now_iso,
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
    _build_spot_from_feed,
    _stale_spot_or_platform_floor,
)

CACHE_KEY_MATRIX = "market_rate_matrix_v5"
CACHE_KEY_LAST_ROWS = "market_rate_matrix_last_rows_v1"
CACHE_TTL_MATRIX = 90
CACHE_TTL_LAST_ROWS = 86400 * 7

# Banks / fintech — only rows with a public scrape (no spot estimates).
CHANNEL_ROWS = (
    {
        "id": "adcb",
        "name": "ADCB Gold & Silver Account",
        "segment": "Bank · digital gold",
        "fetch": fetch_adcb_xau,
    },
    {
        "id": "cbd",
        "name": "CBD Gold & Silver Account",
        "segment": "Bank · digital gold",
        "fetch": fetch_cbd_xau,
    },
    {
        "id": "mgw",
        "name": "My Gold Wallet (Arakkal board)",
        "segment": "Fintech · digital gold",
        "fetch": fetch_arakkal_retail,
    },
)

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

INSTITUTIONAL_ROWS = (
    {
        "id": "mks_pamp",
        "name": "MKS PAMP GROUP desk",
        "segment": "Institutional · refinery trading",
        "fetch": fetch_mks_pamp,
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
    source_updated_at=None,
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
        "source_updated_at": source_updated_at,
        "is_cridora": is_cridora,
    }
    if source_url:
        out["source_url"] = source_url
    return out


def _spot_payload():
    """Cridora comparison row = published wallet (Aani) ticker, not an inflated figure."""
    from cridora.pricing_engine import build_wallet_ticker_payload

    data = _build_spot_from_feed()
    if not data:
        data = _stale_spot_or_platform_floor()
    return build_wallet_ticker_payload(data)


def _row_from_fetch(row_def, fetched, availability="live"):
    return _row(
        row_def["id"],
        row_def["name"],
        row_def["segment"],
        rate_24k=fetched.get("rate_24k"),
        rate_22k=fetched.get("rate_22k"),
        availability=availability,
        note=fetched.get("note") or "",
        source_url=fetched.get("source_url"),
        source_updated_at=fetched.get("source_updated_at") or fetched.get("fetched_at"),
    )


def _resolve_fetched_row(row_def, last_good, new_last_good):
    row_id = row_def["id"]
    fetched = row_def["fetch"]()
    if fetched and fetched.get("rate_24k"):
        row = _row_from_fetch(row_def, fetched, availability="live")
        new_last_good[row_id] = {
            "rate_24k": row["rate_24k"],
            "rate_22k": row["rate_22k"],
            "note": row.get("note") or "",
            "source_url": row.get("source_url"),
            "source_updated_at": row.get("source_updated_at"),
            "fetched_at": fetched.get("fetched_at") or _now_iso(),
        }
        return row
    cached = last_good.get(row_id)
    if cached and cached.get("rate_24k"):
        return _row(
            row_id,
            row_def["name"],
            row_def["segment"],
            rate_24k=cached.get("rate_24k"),
            rate_22k=cached.get("rate_22k"),
            availability="cached",
            note=cached.get("note") or "Last saved rate — source temporarily unreachable.",
            source_url=cached.get("source_url"),
            source_updated_at=cached.get("source_updated_at") or cached.get("fetched_at"),
        )
    return None


def _filter_rows_above_cridora(rows, cridora_ref):
    if cridora_ref is None or float(cridora_ref) <= 0:
        return [r for r in rows if r.get("is_cridora") or r.get("rate_24k") is not None]
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
    last_good = cache.get(CACHE_KEY_LAST_ROWS) or {}
    new_last_good = dict(last_good)

    spot = _spot_payload()
    gold = spot.get("gold") if isinstance(spot.get("gold"), dict) else {}
    g24_spot = gold.get("24K")
    g22_spot = gold.get("22K")
    source = spot.get("source") or "unknown"
    matrix_fetched_at = _now_iso()

    cridora_ref = None
    cridora_availability = "live"
    cridora_updated = matrix_fetched_at
    if source == "stale_cache":
        cridora_availability = "cached"
        cridora_updated = last_good.get("cridora", {}).get("source_updated_at") or matrix_fetched_at

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
                "Same global spot feed as the header ticker — "
                "checkout uses each vendor's quoted price."
            )
        cridora_row = _row(
            "cridora",
            cridora_label,
            cridora_segment,
            rate_24k=round(float(g24_spot), 2),
            rate_22k=round(float(g22_spot), 2) if g22_spot else _derive_22k(g24_spot),
            availability=cridora_availability,
            note=cridora_note if source != "stale_cache" else (
                (spot.get("note") or "Last saved spot feed.")
            ),
            source_updated_at=cridora_updated,
            is_cridora=True,
        )
        rows.append(cridora_row)
        new_last_good["cridora"] = {
            "rate_24k": cridora_row["rate_24k"],
            "rate_22k": cridora_row["rate_22k"],
            "source_updated_at": cridora_updated,
            "fetched_at": matrix_fetched_at,
        }
    elif last_good.get("cridora", {}).get("rate_24k"):
        cached = last_good["cridora"]
        cridora_ref = float(cached["rate_24k"])
        rows.append(
            _row(
                "cridora",
                "Cridora reference ticker",
                "Platform spot display",
                rate_24k=cached.get("rate_24k"),
                rate_22k=cached.get("rate_22k"),
                availability="cached",
                note="Last saved Cridora reference — live feed temporarily unavailable.",
                source_updated_at=cached.get("source_updated_at") or cached.get("fetched_at"),
                is_cridora=True,
            )
        )
    else:
        rows.append(
            _row(
                "cridora",
                "Cridora Marketplace",
                "Verified vendor listings",
                note="Live reference rate unavailable — compare vendor quotes on the marketplace.",
                source_updated_at=matrix_fetched_at,
                is_cridora=True,
            )
        )

    for block in (INSTITUTIONAL_ROWS, RETAIL_ROWS, CHANNEL_ROWS):
        for row_def in block:
            resolved = _resolve_fetched_row(row_def, last_good, new_last_good)
            if resolved:
                rows.append(resolved)

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
    cache.set(CACHE_KEY_LAST_ROWS, new_last_good, timeout=CACHE_TTL_LAST_ROWS)

    return {
        "currency": "AED",
        "unit": "per_gram",
        "updated_at": matrix_fetched_at,
        "cridora_reference_24k": cridora_ref,
        "spot_source": source,
        "disclaimer": (
            "Published rates only — no estimates. Rows show scraped public sources or "
            "last saved values when a source is temporarily down. Only channels priced above "
            "Cridora's reference 24K are listed. Cridora checkout uses your vendor quote."
        ),
        "rows": rows,
    }


class MarketRateMatrixView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from cridora.rate_ledger import matrix_payload_from_ledger, sync_comparison_from_matrix

        cached = cache.get(CACHE_KEY_MATRIX)
        if cached:
            return Response(cached)
        try:
            data = build_market_matrix()
            cache.set(CACHE_KEY_MATRIX, data, timeout=CACHE_TTL_MATRIX)
            sync_comparison_from_matrix(data, reason='matrix_refresh')
            return Response(data)
        except Exception:
            ledger = matrix_payload_from_ledger()
            if ledger:
                return Response(ledger)
            raise
