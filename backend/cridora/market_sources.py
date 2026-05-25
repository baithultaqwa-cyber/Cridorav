"""Best-effort public UAE gold rate fetchers for the market comparison matrix."""
import re

import requests as http_requests

from cridora.retail_rates import (
    _fetch_mint_jewels_html,
    _parse_aed_after_label,
    parse_mint_jewels_html,
)
from cridora.spot_prices import TROY_OZ_TO_GRAMS, fetch_usd_to_aed

DEFAULT_USD_AED = 3.6725
KARAT_22_RATIO = 0.9167

ADCB_FX_URL = "https://www.adcb.com/en/personal/accounts/money-transfer/fx-rate"
CBD_FX_URLS = (
    "https://www.cbd.ae/tools-and-resources/foreign-exchange-rates",
    "https://www.cbd.ae/personal/accounts/gold-and-silver-account",
)
MKS_PAMP_URL = "https://live.mkspamp.com/MKSPricing/prices.xhtml"
MALABAR_GOLD_RATE_URL = (
    "https://www.malabargoldanddiamonds.com/ae/malabarprice/index/currentGoldRate/"
)
SKY_JEWELLERY_GOLD_URL = "https://www.skyjewellery.com/gold-rate/"
JOYALUKKAS_AE_GOLD_URL = "https://www.joyalukkas.com/ae/goldrate"

_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; Cridora/1.0; market matrix)"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def _derive_22k(rate_24k):
    if rate_24k is None:
        return None
    try:
        return round(float(rate_24k) * KARAT_22_RATIO, 2)
    except (TypeError, ValueError):
        return None


def _oz_aed_to_gram(rate_aed_per_oz):
    return round(float(rate_aed_per_oz) / TROY_OZ_TO_GRAMS, 2)


def _usd_oz_to_aed_gram(usd_per_oz, usd_aed):
    return round((float(usd_per_oz) / TROY_OZ_TO_GRAMS) * float(usd_aed), 2)


def _get_html(url, timeout=12):
    try:
        resp = http_requests.get(
            url, timeout=timeout, headers=_HTTP_HEADERS,
        )
    except http_requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    return resp.text or ""


def _parse_embedded_aed_xau_block(html):
    """Parse ADCB-style embedded FX JSON: AED→XAU mid/buy/sell (AED per troy oz)."""
    if not html:
        return None
    m = re.search(
        r"FromCurrency':'AED','ToCurrency':'XAU'[^}]+}",
        html,
    )
    if not m:
        return None
    block = m.group(0)
    mid_m = re.search(r"MidRate':([\d.]+)", block)
    sell_m = re.search(r"SellRate':([\d.]+)", block)
    if not mid_m:
        return None
    try:
        mid_oz = float(mid_m.group(1))
        sell_oz = float(sell_m.group(1)) if sell_m else None
    except ValueError:
        return None
    if mid_oz <= 0:
        return None
    mid_g = _oz_aed_to_gram(mid_oz)
    sell_g = _oz_aed_to_gram(sell_oz) if sell_oz and sell_oz > 0 else None
    return {"mid_g": mid_g, "sell_g": sell_g}


def fetch_adcb_xau():
    """
    ADCB publishes XAU on its public FX page (JSON embedded in HTML).
    Uses mid-rate (closest to digital-gold reference); sell-rate kept for notes.
    """
    html = _get_html(ADCB_FX_URL)
    parsed = _parse_embedded_aed_xau_block(html)
    if not parsed:
        return None
    mid_g = parsed["mid_g"]
    sell_g = parsed.get("sell_g")
    note = (
        "Public ADCB FX mid-rate (AED/troy oz → AED/g). "
        "Digital gold app buy/sell may differ slightly."
    )
    if sell_g:
        note += f" FX desk sell-side reference: AED {sell_g}/g."
    return {
        "rate_24k": mid_g,
        "rate_22k": _derive_22k(mid_g),
        "availability": "indicative",
        "source_url": ADCB_FX_URL,
        "note": note,
    }


def fetch_cbd_xau():
    """
    CBD digital gold has no public XAU table in page HTML (rates load in-app / FX portal).
    Probe known public URLs; return None so the matrix uses indicative estimate.
    """
    for url in CBD_FX_URLS:
        html = _get_html(url)
        parsed = _parse_embedded_aed_xau_block(html)
        if parsed:
            mid_g = parsed["mid_g"]
            return {
                "rate_24k": mid_g,
                "rate_22k": _derive_22k(mid_g),
                "availability": "indicative",
                "source_url": url,
                "note": (
                    "Public CBD FX reference (AED/troy oz → AED/g). "
                    "Digital gold app pricing may differ."
                ),
            }
    return None


def fetch_mks_pamp():
    """MKS PAMP public wholesale desk — XAU/USD WE SELL converted to AED/g."""
    html = _get_html(MKS_PAMP_URL)
    if not html:
        return None
    m = re.search(
        r"XAU/USD.*?sellPriceCell.*?bigfont1\">([\d.]+)\.</span>"
        r"<span class=\"bigfont2\">([\d.]+)",
        html,
        re.S,
    )
    if not m:
        return None
    usd_per_oz = float(f"{m.group(1)}.{m.group(2)}")
    if usd_per_oz <= 0:
        return None
    usd_aed, _ = fetch_usd_to_aed()
    rate_24k = _usd_oz_to_aed_gram(usd_per_oz, usd_aed or DEFAULT_USD_AED)
    return {
        "rate_24k": rate_24k,
        "rate_22k": _derive_22k(rate_24k),
        "availability": "live",
        "source_url": MKS_PAMP_URL,
        "note": "Public WE SELL XAU/USD desk rate converted to AED/g (wholesale).",
    }


def fetch_mint_jewels():
    try:
        resp = _fetch_mint_jewels_html()
    except http_requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    gold, _silver = parse_mint_jewels_html(resp.text or "")
    if not gold.get("24K"):
        return None
    rate_24k = round(float(gold["24K"]), 2)
    rate_22k = (
        round(float(gold["22K"]), 2)
        if gold.get("22K")
        else _derive_22k(rate_24k)
    )
    return {
        "rate_24k": rate_24k,
        "rate_22k": rate_22k,
        "availability": "live",
        "source_url": "https://mintjewels.ae/live-gold-price-dubai/",
        "note": "Public Dubai retail board — shop invoice may add making charges & VAT.",
    }


def _parse_karat_aed_table(html):
    """Parse retail board rows like '24 KT(999) ... AED 549.76/g'."""
    if not html:
        return {}
    gold = {}
    for karat, label in (("24K", r"24\s*KT"), ("22K", r"22\s*KT"), ("21K", r"21\s*KT"), ("18K", r"18\s*KT")):
        m = re.search(
            label + r"[\s\S]{0,160}?AED\s*([\d,]+\.?\d*)",
            html,
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
    return gold


def fetch_malabar_uae():
    """Malabar UAE JSON endpoint returns HTML table in data field (live during market hours)."""
    try:
        resp = http_requests.get(
            MALABAR_GOLD_RATE_URL,
            timeout=12,
            headers={**_HTTP_HEADERS, "Accept": "application/json,text/plain,*/*"},
        )
    except http_requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    try:
        payload = resp.json()
    except ValueError:
        return None
    html = payload.get("data") if isinstance(payload, dict) else ""
    gold = _parse_karat_aed_table(html or "")
    if not gold.get("24K"):
        return None
    rate_24k = gold["24K"]
    return {
        "rate_24k": rate_24k,
        "rate_22k": gold.get("22K") or _derive_22k(rate_24k),
        "availability": "live",
        "source_url": MALABAR_GOLD_RATE_URL,
        "note": "Malabar Gold & Diamonds UAE public rate board (AED/g).",
    }


def fetch_sky_jewellery():
    """Sky Jewellery Dubai — UAE block uses '24KT-xxx AED/gram' in page HTML."""
    html = _get_html(SKY_JEWELLERY_GOLD_URL)
    if not html:
        return None
    m24 = re.search(r"24KT-([\d.]+)\s*AED/gram", html, re.IGNORECASE)
    m22 = re.search(r"22KT-([\d.]+)\s*AED/gram", html, re.IGNORECASE)
    if not m24:
        return None
    try:
        rate_24k = round(float(m24.group(1)), 2)
    except ValueError:
        return None
    if rate_24k <= 0:
        return None
    rate_22k = round(float(m22.group(1)), 2) if m22 else _derive_22k(rate_24k)
    return {
        "rate_24k": rate_24k,
        "rate_22k": rate_22k,
        "availability": "live",
        "source_url": SKY_JEWELLERY_GOLD_URL,
        "note": "Sky Jewellery UAE public gold board (government-linked Dubai rate).",
    }


def fetch_joyalukkas_ae():
    """
    Joyalukkas AE goldrate is a client-rendered SPA — no stable public rate in HTML.
    Returns None; matrix may fall back to nothing for this row.
    """
    html = _get_html(JOYALUKKAS_AE_GOLD_URL)
    if not html:
        return None
    gold = _parse_karat_aed_table(html)
    if gold.get("24K"):
        rate_24k = gold["24K"]
        return {
            "rate_24k": rate_24k,
            "rate_22k": gold.get("22K") or _derive_22k(rate_24k),
            "availability": "live",
            "source_url": JOYALUKKAS_AE_GOLD_URL,
            "note": "Joyalukkas UAE public rate board (AED/g).",
        }
    return None


ARAKKAL_GOLD_URL = "https://arakkalgoldanddiamonds.com/gold-rate/"


def fetch_arakkal_retail():
    html = _get_html(ARAKKAL_GOLD_URL, timeout=8)
    if not html:
        return None
    gold = {}
    for karat, label in (("24K", r"24\s*KT"), ("22K", r"22\s*KT")):
        v = _parse_aed_after_label(html, label)
        if v is not None and v > 0:
            gold[karat] = round(v, 2)
    if not gold.get("24K"):
        return None
    rate_24k = gold["24K"]
    return {
        "rate_24k": rate_24k,
        "rate_22k": gold.get("22K") or _derive_22k(rate_24k),
        "availability": "live",
        "source_url": ARAKKAL_GOLD_URL,
        "note": "Public Dubai retail board (Arakkal) — indicative shop counter rate.",
    }


def estimate_from_spot(spot_24k, markup_pct):
    if spot_24k is None or float(spot_24k) <= 0:
        return None
    rate_24k = round(float(spot_24k) * (1 + float(markup_pct) / 100), 2)
    return {
        "rate_24k": rate_24k,
        "rate_22k": _derive_22k(rate_24k),
        "availability": "indicative",
        "note": None,
    }
