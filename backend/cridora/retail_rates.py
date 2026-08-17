"""Dubai retail precious-metal board rates from public dealer pages (best-effort HTML parse)."""
from __future__ import annotations

import logging
import re

import requests as http_requests
from django.core.cache import cache
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

MINT_JEWELS_LIVE_URL = "https://mintjewels.ae/live-gold-price-dubai/"
DUBAI_CITY_OF_GOLD_URL = "https://www.dubaicityofgold.com/"
MALABAR_GOLD_RATE_URL = (
    "https://www.malabargoldanddiamonds.com/ae/malabarprice/index/currentGoldRate/"
)
SKY_JEWELLERY_GOLD_URL = "https://www.skyjewellery.com/gold-rate/"

CACHE_KEY_RETAIL = "dubai_retail_board_v2"
CACHE_TTL_RETAIL = 120

GOLD_KARATS = ("24K", "22K", "21K", "18K")
SILVER_FINENESS = ("999", "925")

# Browser-like UA — several dealer sites 403 bot-style agents.
_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}


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
        if v is None:
            v = _parse_aed_after_label(html, rf"{re.escape(karat)}\s*Gold")
        if v is not None and v > 0:
            gold[karat] = round(v, 2)
    for fin in SILVER_FINENESS:
        v = _parse_aed_after_label(html, rf"Silver\s*{re.escape(fin)}")
        if v is not None and v > 0:
            silver[fin] = round(v, 3)
    return gold, silver


def parse_dubai_city_of_gold_html(html: str):
    """Parse Dubai City of Gold board widgets: `24K Gold` + `AED 530.75`."""
    gold = {}
    for m in re.finditer(
        r'class="sortd-gold-type">\s*([^<]+?)\s*</span>\s*'
        r'<span class="sortd-gold-value">\s*AED\s*([\d,]+\.?\d*)',
        html or "",
        re.IGNORECASE,
    ):
        label = re.sub(r"\s+", " ", (m.group(1) or "").strip())
        try:
            val = float(m.group(2).replace(",", ""))
        except ValueError:
            continue
        if val <= 0:
            continue
        km = re.match(r"(24|22|21|18)\s*K", label, re.IGNORECASE)
        if not km:
            continue
        gold[f"{km.group(1)}K"] = round(val, 2)
    # Fallback label scan if widget class names change.
    if not gold:
        for karat in GOLD_KARATS:
            v = _parse_aed_after_label(html, rf"{re.escape(karat)}\s*Gold")
            if v is not None and v > 0:
                gold[karat] = round(v, 2)
    return gold, {}


def parse_malabar_html(html: str):
    """Parse Malabar UAE rate snippet (`24 KT(999) - AED 530.75/g`)."""
    gold = {}
    for karat, label in (
        ("24K", r"24\s*KT"),
        ("22K", r"22\s*KT"),
        ("21K", r"21\s*KT"),
        ("18K", r"18\s*KT"),
    ):
        m = re.search(
            label + r"[\s\S]{0,160}?AED\s*([\d,]+\.?\d*)",
            html or "",
            re.IGNORECASE,
        )
        if not m:
            continue
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        if v > 0:
            gold[karat] = round(v, 2)
    return gold, {}


def parse_sky_jewellery_html(html: str):
    gold = {}
    for karat, pat in (
        ("24K", r"24KT-([\d.]+)\s*AED/gram"),
        ("22K", r"22KT-([\d.]+)\s*AED/gram"),
        ("21K", r"21KT-([\d.]+)\s*AED/gram"),
        ("18K", r"18KT-([\d.]+)\s*AED/gram"),
    ):
        m = re.search(pat, html or "", re.IGNORECASE)
        if not m:
            continue
        try:
            v = float(m.group(1))
        except ValueError:
            continue
        if v > 0:
            gold[karat] = round(v, 2)
    return gold, {}


def _fetch_html(url: str, *, timeout: int = 12, accept: str | None = None):
    headers = dict(_HTTP_HEADERS)
    if accept:
        headers["Accept"] = accept
    return http_requests.get(url, timeout=timeout, headers=headers)


def _fetch_mint_jewels_html():
    """Backward-compatible helper used by market matrix / Rate B."""
    return _fetch_html(MINT_JEWELS_LIVE_URL)


def _ok_board(gold: dict, silver: dict) -> bool:
    return bool(gold.get("24K") or gold.get("22K") or silver.get("999"))


def _try_source(name: str, url: str, fetcher) -> dict | None:
    try:
        gold, silver, meta_url = fetcher()
    except http_requests.RequestException as exc:
        logger.info("retail source %s network error: %s", name, exc)
        return None
    except Exception:
        logger.exception("retail source %s failed", name)
        return None
    if not _ok_board(gold or {}, silver or {}):
        logger.info("retail source %s returned empty board", name)
        return None
    return {
        "currency": "AED",
        "unit": "per_gram",
        "source": name,
        "source_url": meta_url or url,
        "source_label": f"Dubai retail board ({name})",
        "gold": gold or {},
        "silver": silver or {},
        "fetched_at": timezone.now().isoformat(),
    }


def _source_mint():
    resp = _fetch_html(MINT_JEWELS_LIVE_URL)
    if resp.status_code != 200:
        raise http_requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
    gold, silver = parse_mint_jewels_html(resp.text or "")
    return gold, silver, MINT_JEWELS_LIVE_URL


def _source_dubai_city_of_gold():
    resp = _fetch_html(DUBAI_CITY_OF_GOLD_URL)
    if resp.status_code != 200:
        raise http_requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
    gold, silver = parse_dubai_city_of_gold_html(resp.text or "")
    return gold, silver, DUBAI_CITY_OF_GOLD_URL


def _source_malabar():
    resp = _fetch_html(
        MALABAR_GOLD_RATE_URL,
        accept="application/json,text/plain,*/*",
    )
    if resp.status_code != 200:
        raise http_requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
    html = ""
    try:
        payload = resp.json()
        if isinstance(payload, dict):
            html = payload.get("data") or ""
    except ValueError:
        html = resp.text or ""
    gold, silver = parse_malabar_html(html)
    return gold, silver, MALABAR_GOLD_RATE_URL


def _source_sky():
    resp = _fetch_html(SKY_JEWELLERY_GOLD_URL)
    if resp.status_code != 200:
        raise http_requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
    gold, silver = parse_sky_jewellery_html(resp.text or "")
    return gold, silver, SKY_JEWELLERY_GOLD_URL


RETAIL_SOURCES = (
    ("mintjewels", MINT_JEWELS_LIVE_URL, _source_mint),
    ("dubaicityofgold", DUBAI_CITY_OF_GOLD_URL, _source_dubai_city_of_gold),
    ("malabar_uae", MALABAR_GOLD_RATE_URL, _source_malabar),
    ("skyjewellery", SKY_JEWELLERY_GOLD_URL, _source_sky),
)


def fetch_dubai_retail_board(*, force_refresh: bool = False) -> dict | None:
    """
    Fetch Dubai retail Rate B from public jeweller boards.
    Tries Mint Jewels → Dubai City of Gold → Malabar UAE → Sky Jewellery.
    """
    if not force_refresh:
        cached = cache.get(CACHE_KEY_RETAIL)
        if cached and isinstance(cached, dict) and _ok_board(
            cached.get("gold") or {}, cached.get("silver") or {}
        ):
            return cached

    for name, url, fetcher in RETAIL_SOURCES:
        payload = _try_source(name, url, fetcher)
        if payload:
            cache.set(CACHE_KEY_RETAIL, payload, timeout=CACHE_TTL_RETAIL)
            return payload
    return None


class DubaiRetailRatesView(APIView):
    """Public UAE retail-style board rates (third-party page; indicative)."""

    permission_classes = [AllowAny]

    def get(self, request):
        force = str(request.query_params.get("refresh") or "").lower() in ("1", "true", "yes")
        data = fetch_dubai_retail_board(force_refresh=force)
        if not data:
            return Response(_error_payload("Could not reach any Dubai retail source."))
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
