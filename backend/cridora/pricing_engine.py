"""
Principal-trading pricing engine (Cridora wallet ticker).

Core profit identity:
    profit_per_gram = locked_cridora_wallet_rate − best_vendor_landed_cost

Rate A (spot) and Rate B (retail) are inputs/guards.
Wallet is the published customer ticker (band-validated).
Card is derived from wallet: wallet ÷ (1 − card_cost_pct/100).

Platinum/palladium bypass this module (vendor-manual only).

Money path: Decimal end-to-end via cridora.money (ROUND_HALF_UP, 4dp rates).
"""
from __future__ import annotations

import copy
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from cridora.money import ZERO, as_api_number, rate_4dp, to_decimal

logger = logging.getLogger(__name__)

CACHE_KEY_LAST_VALID_WALLET = 'pricing_engine_last_valid_wallet_v1'
CACHE_TTL_LAST_VALID = 86400 * 7
CACHE_KEY_RATE_B_LIVE = 'pricing_engine_rate_b_live_v1'
CACHE_KEY_ADMIN_ALERTS = 'pricing_engine_admin_alerts_v1'
CACHE_KEY_WALLET_TICKER = 'pricing_engine_wallet_ticker_v1'
CACHE_TTL_WALLET_TICKER = 10
ADMIN_ALERTS_MAX = 40

STATUS_PUBLISH = 'publish'
STATUS_BLOCKED = 'blocked'
STATUS_WARN = 'warn'
STATUS_EMPTY_BAND = 'empty_band'
STATUS_HOLD = 'hold_last'

CEILING_WARN_ONLY = 'warn_only'
CEILING_CLAMP = 'clamp_to_ceiling'
STALE_HOLD_WARN = 'hold_last_warn'
STALE_HALT = 'halt_quotes'

ONE = Decimal('1')
HUNDRED = Decimal('100')


@dataclass(frozen=True)
class BandDecision:
    status: str
    wallet_rate: Decimal | None
    candidate: Decimal
    floor: Decimal
    ceiling: Decimal | None
    alert: str | None = None
    flagged: bool = False


def _cfg():
    from users.models import PlatformConfig
    return PlatformConfig.get()


def wallet_markup_pct(metal: str, cfg=None) -> Decimal:
    """Per-metal admin wallet markup % (replaces platform-wide home_spot_display_margin_pct)."""
    cfg = cfg or _cfg()
    metal = (metal or '').lower()
    if metal == 'silver':
        return to_decimal(getattr(cfg, 'wallet_markup_pct_silver', None) or ZERO)
    # Gold (and legacy callers)
    gold = getattr(cfg, 'wallet_markup_pct_gold', None)
    if gold is None or to_decimal(gold) == ZERO:
        # Backward compat: fall back to legacy single margin.
        return to_decimal(getattr(cfg, 'home_spot_display_margin_pct', None) or ZERO)
    return to_decimal(gold)


def min_profit_floor_aed(metal: str, cfg=None) -> Decimal:
    cfg = cfg or _cfg()
    metal = (metal or '').lower()
    if metal == 'silver':
        return rate_4dp(getattr(cfg, 'min_profit_floor_aed_per_g_silver', None) or ZERO)
    return rate_4dp(getattr(cfg, 'min_profit_floor_aed_per_g_gold', None) or Decimal('3.00'))


def card_cost_pct(cfg=None) -> Decimal:
    cfg = cfg or _cfg()
    return to_decimal(getattr(cfg, 'card_cost_pct', None) or Decimal('2.50'))


def card_rate_from_wallet(wallet_rate, cost_pct=None) -> Decimal:
    """card_rate = wallet_rate ÷ (1 − card_cost_pct/100). Preserves wallet-tier margin."""
    w = rate_4dp(wallet_rate)
    pct = to_decimal(cost_pct if cost_pct is not None else card_cost_pct())
    denom = ONE - (pct / HUNDRED)
    if denom <= ZERO:
        return w
    return rate_4dp(w / denom)


def candidate_wallet_rate(rate_a, markup_pct) -> Decimal:
    """candidate_wallet = rate_A × (1 + wallet_markup_pct/100)."""
    a = to_decimal(rate_a)
    m = to_decimal(markup_pct)
    return rate_4dp(a * (ONE + m / HUNDRED))


def _push_admin_alert(code: str, message: str, *, meta: dict | None = None):
    """Append a short-lived admin alert (cache ring). Never raises."""
    try:
        entry = {
            'code': code,
            'message': message,
            'at': timezone.now().isoformat(),
            'meta': meta or {},
        }
        items = cache.get(CACHE_KEY_ADMIN_ALERTS) or []
        if not isinstance(items, list):
            items = []
        items.insert(0, entry)
        cache.set(CACHE_KEY_ADMIN_ALERTS, items[:ADMIN_ALERTS_MAX], timeout=86400 * 3)
        logger.warning('pricing_engine alert [%s]: %s', code, message)
    except Exception:
        logger.exception('pricing_engine alert push failed')


def get_admin_pricing_alerts(limit: int = 20) -> list:
    items = cache.get(CACHE_KEY_ADMIN_ALERTS) or []
    if not isinstance(items, list):
        return []
    return items[: max(0, int(limit))]


# ── Rate A helpers ───────────────────────────────────────────────────────────

def rate_a_for_purity(metal: str, purity: str, raw_spot: dict | None) -> Decimal | None:
    """Spot (Rate A) AED/g for a purity tier from an unmarginated spot payload."""
    if not raw_spot or not isinstance(raw_spot, dict):
        return None
    from cridora.spot_prices import gold_rate_for_purity_tier, silver_rate_for_purity_tier

    metal = (metal or '').lower()
    if metal == 'gold' and isinstance(raw_spot.get('gold'), dict):
        v = gold_rate_for_purity_tier(raw_spot['gold'], purity)
    elif metal == 'silver' and isinstance(raw_spot.get('silver'), dict):
        v = silver_rate_for_purity_tier(raw_spot['silver'], purity)
    else:
        return None
    d = to_decimal(v)
    return rate_4dp(d) if d > ZERO else None


# ── Rate B (retail ceiling) ──────────────────────────────────────────────────

def _scale_rate_b_from_base(metal: str, purity: str, base_rate: Decimal, raw_spot: dict | None) -> Decimal:
    """Scale a 24K/999 Rate B figure to another purity using Rate A purity ratios when available."""
    metal = (metal or '').lower()
    base_key = '24K' if metal == 'gold' else '999'
    a_base = rate_a_for_purity(metal, base_key, raw_spot) if raw_spot else None
    a_tier = rate_a_for_purity(metal, purity, raw_spot) if raw_spot else None
    if a_base and a_base > ZERO and a_tier and a_tier > ZERO:
        return rate_4dp(base_rate * (a_tier / a_base))
    # Static karat / fineness fallback
    from cridora.spot_prices import GOLD_KARAT_PURITY, SILVER_FINENESS
    if metal == 'gold':
        p = GOLD_KARAT_PURITY.get((purity or '24K').strip().upper()) or GOLD_KARAT_PURITY.get(purity) or 1.0
        return rate_4dp(base_rate * to_decimal(p))
    p = SILVER_FINENESS.get((purity or '999').strip()) or 1.0
    return rate_4dp(base_rate * to_decimal(p))


def _rate_b_from_manual(metal: str, purity: str, cfg, raw_spot: dict | None) -> Decimal | None:
    """Read admin Rate B override (JSON or legacy single 24K/999 fields)."""
    metal = (metal or '').lower()
    override = getattr(cfg, 'rate_b_manual_override', None) or {}
    if isinstance(override, dict):
        block = override.get(metal) if isinstance(override.get(metal), dict) else {}
        if block:
            # Exact purity key
            for k, v in block.items():
                if str(k).strip().lower() == (purity or '').strip().lower():
                    d = to_decimal(v)
                    if d > ZERO:
                        return rate_4dp(d)
            base_key = '24K' if metal == 'gold' else '999'
            base_v = None
            for k, v in block.items():
                if str(k).strip().upper() == base_key or str(k).strip() == base_key:
                    base_v = to_decimal(v)
                    break
            if base_v and base_v > ZERO:
                if (purity or '').strip().upper() == base_key or (purity or '').strip() == base_key:
                    return rate_4dp(base_v)
                return _scale_rate_b_from_base(metal, purity, rate_4dp(base_v), raw_spot)

    # Flat single-field fallbacks (admin convenience)
    if metal == 'gold':
        flat = getattr(cfg, 'rate_b_manual_override_gold_24k_aed_per_g', None)
        if flat is not None and to_decimal(flat) > ZERO:
            base = rate_4dp(flat)
            if (purity or '24K').strip().upper() in ('24K', '24'):
                return base
            return _scale_rate_b_from_base(metal, purity, base, raw_spot)
    if metal == 'silver':
        flat = getattr(cfg, 'rate_b_manual_override_silver_999_aed_per_g', None)
        if flat is not None and to_decimal(flat) > ZERO:
            base = rate_4dp(flat)
            if (purity or '999').strip() == '999':
                return base
            return _scale_rate_b_from_base(metal, purity, base, raw_spot)
    return None


def _fetch_rate_b_live(cfg=None) -> dict | None:
    """
    Best-effort Rate B scrape (Phase 1: reuse Mint Jewels retail board).
    Cached with a fetched_at timestamp for staleness checks.
    """
    cfg = cfg or _cfg()
    cached = cache.get(CACHE_KEY_RATE_B_LIVE)
    if cached and isinstance(cached, dict) and cached.get('gold'):
        return cached

    try:
        from cridora.retail_rates import _fetch_mint_jewels_html, parse_mint_jewels_html

        resp = _fetch_mint_jewels_html()
        if resp.status_code != 200:
            return None
        gold, silver = parse_mint_jewels_html(resp.text or '')
        if not gold and not silver:
            return None
        payload = {
            'currency': 'AED',
            'unit': 'per_gram',
            'source': 'mintjewels',
            'source_url': getattr(cfg, 'rate_b_source_url', '') or '',
            'gold': gold,
            'silver': silver,
            'fetched_at': timezone.now().isoformat(),
        }
        # Cache shorter than staleness max so we re-check freshness regularly.
        max_min = int(getattr(cfg, 'rate_b_staleness_max_minutes', 15) or 15)
        ttl = max(60, min(max_min * 60, 900))
        cache.set(CACHE_KEY_RATE_B_LIVE, payload, timeout=ttl)
        return payload
    except Exception:
        logger.exception('Rate B live fetch failed')
        return None


def _rate_b_age_minutes(payload: dict | None) -> float | None:
    if not payload or not isinstance(payload, dict):
        return None
    ts = payload.get('fetched_at')
    if not ts:
        return None
    try:
        from django.utils.dateparse import parse_datetime
        dt = parse_datetime(str(ts))
        if dt is None:
            return None
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return max(0.0, (timezone.now() - dt).total_seconds() / 60.0)
    except Exception:
        return None


def resolve_rate_b(metal: str, purity: str, cfg=None, raw_spot: dict | None = None) -> tuple[Decimal | None, dict]:
    """
    Resolve Rate B (retail ceiling) with staleness fallback.

    Returns (rate_or_None, meta) where meta includes source and stale flags.
    """
    cfg = cfg or _cfg()
    metal = (metal or '').lower()
    max_min = int(getattr(cfg, 'rate_b_staleness_max_minutes', 15) or 15)
    policy = str(getattr(cfg, 'rate_b_stale_policy', STALE_HOLD_WARN) or STALE_HOLD_WARN).strip().lower()
    meta: dict[str, Any] = {
        'source': None,
        'stale': False,
        'age_minutes': None,
        'policy': policy,
        'halt_quotes': False,
    }

    live = _fetch_rate_b_live(cfg)
    age = _rate_b_age_minutes(live)
    meta['age_minutes'] = age
    live_ok = False
    live_rate = None
    if live and age is not None and age <= max_min:
        block = live.get(metal) if isinstance(live.get(metal), dict) else {}
        if block:
            for k, v in block.items():
                if str(k).strip().lower() == (purity or '').strip().lower():
                    d = to_decimal(v)
                    if d > ZERO:
                        live_rate = rate_4dp(d)
                        live_ok = True
                        break
            if not live_ok:
                base_key = '24K' if metal == 'gold' else '999'
                base_v = None
                for k, v in block.items():
                    if str(k).strip().upper() == base_key or str(k).strip() == base_key:
                        base_v = to_decimal(v)
                        break
                if base_v and base_v > ZERO:
                    live_rate = _scale_rate_b_from_base(metal, purity, rate_4dp(base_v), raw_spot)
                    live_ok = live_rate > ZERO

    if live_ok and live_rate is not None:
        meta['source'] = 'live_scrape'
        return live_rate, meta

    # Stale or missing live → manual override
    if live is not None and (age is None or age > max_min):
        meta['stale'] = True

    manual = _rate_b_from_manual(metal, purity, cfg, raw_spot)
    if manual is not None and manual > ZERO:
        meta['source'] = 'manual_override'
        if meta['stale']:
            _push_admin_alert(
                'rate_b_stale',
                f'Rate B scrape stale/unavailable; using manual override for {metal} {purity}.',
                meta={'metal': metal, 'purity': purity, 'age_minutes': age},
            )
        return manual, meta

    # No usable Rate B
    meta['source'] = 'unavailable'
    meta['stale'] = True
    if policy == STALE_HALT:
        meta['halt_quotes'] = True
        _push_admin_alert(
            'rate_b_halt',
            f'Rate B unavailable and stale policy=halt_quotes — holding last valid ticker ({metal} {purity}).',
            meta={'metal': metal, 'purity': purity},
        )
    else:
        _push_admin_alert(
            'rate_b_missing',
            f'Rate B unavailable for {metal} {purity}; band ceiling open — floor guard still active.',
            meta={'metal': metal, 'purity': purity},
        )
    return None, meta


# ── Vendor landed cost (wholesale) ───────────────────────────────────────────

def resolve_vendor_landed_cost(cfg, metal: str, purity: str, rate_a: Decimal) -> Decimal | None:
    """
    What Cridora pays the vendor per gram (wholesale landed cost).

    Live path: rate_A + agreed markup (fixed AED/g or percent of Rate A).
    Manual/legacy gram map is a fallback only when Auto markup path is unavailable.
    """
    if metal not in ('gold', 'silver'):
        return None
    from cridora.purity_pricing import (
        MARKUP_TYPE_FIXED,
        get_from_purity_map,
        get_metal_gram_map,
        get_purity_spot_config,
    )

    a = rate_4dp(rate_a)
    if a <= ZERO:
        return None

    conf = get_purity_spot_config(cfg, metal, purity)
    if conf.get('use_live'):
        if conf.get('markup_type') == MARKUP_TYPE_FIXED:
            return rate_4dp(a + to_decimal(conf.get('markup_value') or ZERO))
        mup = ONE + to_decimal(conf.get('markup_value') or ZERO) / HUNDRED
        return rate_4dp(a * mup)

    gmap = get_metal_gram_map(cfg, metal)
    v_gram, _ = get_from_purity_map(gmap, purity)
    if v_gram is not None and to_decimal(v_gram) > ZERO:
        return rate_4dp(v_gram)

    # Legacy headline rates as last-resort cost estimate
    legacy = None
    if metal == 'gold':
        legacy = getattr(cfg, 'gold_rate', None)
    elif metal == 'silver':
        legacy = getattr(cfg, 'silver_rate', None)
    if legacy is not None and to_decimal(legacy) > ZERO:
        return rate_4dp(legacy)
    return None


def best_vendor_landed_cost(metal: str, purity: str, rate_a: Decimal) -> tuple[Decimal | None, int | None]:
    """
    argmin(vendor_landed_cost) among KYC-live vendors with trading allowed.
    Returns (cost, vendor_user_id). If none, returns (rate_A, None) as synthetic floor basis.
    """
    from users.models import User, VendorPricingConfig
    from users.compliance import vendor_compliance_verification

    a = rate_4dp(rate_a)
    best: Decimal | None = None
    best_vid: int | None = None

    qs = (
        VendorPricingConfig.objects
        .select_related('user')
        .filter(user__user_type=User.VENDOR, user__is_active=True, user__kyc_status=User.KYC_VERIFIED)
    )
    for vpc in qs:
        try:
            if not vendor_compliance_verification(vpc.user).get('trading_allowed'):
                continue
            cost = resolve_vendor_landed_cost(vpc, metal, purity, a)
            if cost is None or cost <= ZERO:
                continue
            if best is None or cost < best:
                best = cost
                best_vid = vpc.user_id
        except Exception:
            continue

    if best is None:
        # No vendor cost → treat spot as absolute wholesale floor basis.
        return (a if a > ZERO else None), None
    return best, best_vid


# ── Band validation ──────────────────────────────────────────────────────────

def compute_band(metal: str, purity: str, rate_a: Decimal, cfg=None, raw_spot: dict | None = None):
    """
    floor   = best_vendor_landed_cost + min_profit_floor
    ceiling = rate_B − ceiling_epsilon   (None if Rate B unavailable)
    """
    cfg = cfg or _cfg()
    landed, vendor_id = best_vendor_landed_cost(metal, purity, rate_a)
    floor_add = min_profit_floor_aed(metal, cfg)
    floor = rate_4dp(to_decimal(landed or rate_a) + floor_add)

    rate_b, rate_b_meta = resolve_rate_b(metal, purity, cfg=cfg, raw_spot=raw_spot)
    epsilon = rate_4dp(getattr(cfg, 'ceiling_epsilon_aed_per_g', None) or Decimal('0.50'))
    ceiling = rate_4dp(rate_b - epsilon) if rate_b is not None and rate_b > ZERO else None

    return {
        'floor': floor,
        'ceiling': ceiling,
        'best_vendor_landed_cost': landed,
        'best_vendor_id': vendor_id,
        'rate_b': rate_b,
        'rate_b_meta': rate_b_meta,
        'min_profit_floor': floor_add,
        'epsilon': epsilon,
    }


def validate_and_resolve_wallet(
    candidate: Decimal,
    floor: Decimal,
    ceiling: Decimal | None,
    *,
    ceiling_cross_policy: str = CEILING_WARN_ONLY,
    metal: str = 'gold',
    purity: str = '24K',
) -> BandDecision:
    """
    if candidate < floor: BLOCK (serve last valid)
    elif ceiling is not None and candidate > ceiling: WARN (or clamp)
    elif ceiling is not None and ceiling < floor: EMPTY BAND → hold last
    else: PUBLISH
    """
    c = rate_4dp(candidate)
    f = rate_4dp(floor)
    policy = (ceiling_cross_policy or CEILING_WARN_ONLY).strip().lower()

    if ceiling is not None and rate_4dp(ceiling) < f:
        msg = (
            f'Empty band for {metal} {purity}: ceiling {ceiling} < floor {f}. '
            'Holding last valid ticker.'
        )
        _push_admin_alert('empty_band', msg, meta={'metal': metal, 'purity': purity})
        return BandDecision(
            status=STATUS_EMPTY_BAND,
            wallet_rate=None,
            candidate=c,
            floor=f,
            ceiling=rate_4dp(ceiling),
            alert=msg,
            flagged=True,
        )

    if c < f:
        msg = (
            f'Markup produces a below-cost ticker for {metal} {purity}: '
            f'candidate {c} < floor {f}. Serve last valid ticker until fixed.'
        )
        _push_admin_alert('below_cost', msg, meta={'metal': metal, 'purity': purity, 'candidate': str(c), 'floor': str(f)})
        return BandDecision(
            status=STATUS_BLOCKED,
            wallet_rate=None,
            candidate=c,
            floor=f,
            ceiling=rate_4dp(ceiling) if ceiling is not None else None,
            alert=msg,
            flagged=True,
        )

    if ceiling is not None and c > rate_4dp(ceiling):
        msg = (
            f'Ticker is at/above retail for {metal} {purity}: '
            f'candidate {c} > ceiling {ceiling}. Uncompetitive.'
        )
        _push_admin_alert('above_retail', msg, meta={'metal': metal, 'purity': purity})
        if policy == CEILING_CLAMP:
            return BandDecision(
                status=STATUS_WARN,
                wallet_rate=rate_4dp(ceiling),
                candidate=c,
                floor=f,
                ceiling=rate_4dp(ceiling),
                alert=msg,
                flagged=True,
            )
        return BandDecision(
            status=STATUS_WARN,
            wallet_rate=c,
            candidate=c,
            floor=f,
            ceiling=rate_4dp(ceiling),
            alert=msg,
            flagged=True,
        )

    return BandDecision(
        status=STATUS_PUBLISH,
        wallet_rate=c,
        candidate=c,
        floor=f,
        ceiling=rate_4dp(ceiling) if ceiling is not None else None,
        alert=None,
        flagged=False,
    )


def _last_valid_wallet_payload() -> dict | None:
    cached = cache.get(CACHE_KEY_LAST_VALID_WALLET)
    if cached and isinstance(cached, dict) and cached.get('gold') and cached.get('silver'):
        return cached
    try:
        from cridora.rate_ledger import spot_payload_from_ledger
        ledger = spot_payload_from_ledger()
        if ledger and ledger.get('gold') and ledger.get('silver'):
            return ledger
    except Exception:
        pass
    return None


def _store_last_valid(payload: dict):
    try:
        cache.set(CACHE_KEY_LAST_VALID_WALLET, copy.deepcopy(payload), timeout=CACHE_TTL_LAST_VALID)
    except Exception:
        logger.exception('failed to cache last valid wallet ticker')


def resolve_wallet_rate_for_purity(
    metal: str,
    purity: str,
    raw_spot: dict,
    cfg=None,
) -> tuple[Decimal | None, dict]:
    """
    Full §2 pipeline for one metal/purity.
    Returns (published_wallet_rate_or_None, detail_dict).
    """
    cfg = cfg or _cfg()
    metal = (metal or '').lower()
    detail: dict[str, Any] = {'metal': metal, 'purity': purity}

    if metal not in ('gold', 'silver'):
        detail['bypassed'] = True
        return None, detail

    rate_a = rate_a_for_purity(metal, purity, raw_spot)
    if rate_a is None or rate_a <= ZERO:
        detail['error'] = 'missing_rate_a'
        return None, detail

    markup = wallet_markup_pct(metal, cfg)
    candidate = candidate_wallet_rate(rate_a, markup)
    band = compute_band(metal, purity, rate_a, cfg=cfg, raw_spot=raw_spot)

    if band['rate_b_meta'].get('halt_quotes'):
        detail.update({
            'rate_a': rate_a,
            'candidate': candidate,
            'band': band,
            'decision': STATUS_HOLD,
            'alert': 'Rate B stale policy halt_quotes',
        })
        return None, detail

    policy = str(getattr(cfg, 'ceiling_cross_policy', CEILING_WARN_ONLY) or CEILING_WARN_ONLY)
    decision = validate_and_resolve_wallet(
        candidate,
        band['floor'],
        band['ceiling'],
        ceiling_cross_policy=policy,
        metal=metal,
        purity=purity,
    )
    detail.update({
        'rate_a': rate_a,
        'markup_pct': markup,
        'candidate': candidate,
        'band': {
            'floor': band['floor'],
            'ceiling': band['ceiling'],
            'best_vendor_landed_cost': band['best_vendor_landed_cost'],
            'best_vendor_id': band['best_vendor_id'],
            'rate_b': band['rate_b'],
            'rate_b_meta': band['rate_b_meta'],
            'min_profit_floor': band['min_profit_floor'],
        },
        'decision': decision.status,
        'alert': decision.alert,
        'flagged': decision.flagged,
    })
    return decision.wallet_rate, detail


def build_wallet_ticker_payload(raw_spot: dict | None, cfg=None) -> dict:
    """
    Build the public Cridora wallet/Aani ticker from Rate A + per-metal markup,
    band-validated. On block/empty-band/halt: serve last valid ticker from cache/ledger.
    """
    cfg = cfg or _cfg()
    if not raw_spot or not isinstance(raw_spot.get('gold'), dict) or not isinstance(raw_spot.get('silver'), dict):
        held = _last_valid_wallet_payload()
        if held:
            out = copy.deepcopy(held)
            out['source'] = out.get('source') or 'last_valid_wallet'
            out['ticker_label'] = 'Cridora wallet (Aani) rate'
            out['pricing_model'] = 'principal_trading_v1'
            out['note'] = (out.get('note') or '') + ' Holding last valid wallet ticker (spot unavailable).'
            return out
        return {
            'currency': 'AED',
            'unit': 'per_gram',
            'source': 'unavailable',
            'ticker_label': 'Cridora wallet (Aani) rate',
            'pricing_model': 'principal_trading_v1',
            'gold': {},
            'silver': {},
            'note': 'Wallet ticker unavailable.',
        }

    from cridora.spot_prices import GOLD_KARAT_PURITY, SILVER_FINENESS

    gold_out: dict[str, float] = {}
    silver_out: dict[str, float] = {}
    band_meta: dict[str, Any] = {'gold': {}, 'silver': {}}
    any_blocked = False
    any_warn = False

    for karat in GOLD_KARAT_PURITY:
        rate, detail = resolve_wallet_rate_for_purity('gold', karat, raw_spot, cfg=cfg)
        band_meta['gold'][karat] = _detail_for_api(detail)
        if detail.get('decision') in (STATUS_BLOCKED, STATUS_EMPTY_BAND, STATUS_HOLD) or rate is None:
            any_blocked = True
        if detail.get('flagged') and detail.get('decision') == STATUS_WARN:
            any_warn = True
        if rate is not None and rate > ZERO:
            gold_out[karat] = as_api_number(rate)

    for fin in SILVER_FINENESS:
        rate, detail = resolve_wallet_rate_for_purity('silver', fin, raw_spot, cfg=cfg)
        band_meta['silver'][fin] = _detail_for_api(detail)
        if detail.get('decision') in (STATUS_BLOCKED, STATUS_EMPTY_BAND, STATUS_HOLD) or rate is None:
            any_blocked = True
        if detail.get('flagged') and detail.get('decision') == STATUS_WARN:
            any_warn = True
        if rate is not None and rate > ZERO:
            silver_out[fin] = as_api_number(rate)

    # Hold entire book only when primary tiers fail (24K / 999). Lower karat
    # empty-bands must not wipe a valid primary ticker.
    primary_ok = (
        bool(gold_out.get('24K') and gold_out.get('24K') > 0)
        and bool(silver_out.get('999') and silver_out.get('999') > 0)
    )

    if not primary_ok:
        held = _last_valid_wallet_payload()
        if held:
            out = copy.deepcopy(held)
            out['source'] = 'last_valid_wallet'
            out['ticker_label'] = 'Cridora wallet (Aani) rate'
            out['pricing_model'] = 'principal_trading_v1'
            out['band_status'] = 'held'
            out['band_meta'] = band_meta
            out['note'] = (
                'Holding last valid wallet ticker — candidate failed band validation '
                '(below-cost / empty band / Rate B halt). Admin alerted.'
            )
            out['card'] = _card_block_from_wallet(out.get('gold') or {}, out.get('silver') or {}, cfg)
            return out

    cost_pct = card_cost_pct(cfg)
    out = {
        'currency': 'AED',
        'unit': 'per_gram',
        'source': raw_spot.get('source') or 'spot',
        'usd_to_aed': raw_spot.get('usd_to_aed'),
        'usd_to_aed_source': raw_spot.get('usd_to_aed_source'),
        'ticker_label': 'Cridora wallet (Aani) rate',
        'pricing_model': 'principal_trading_v1',
        'gold': gold_out,
        'silver': silver_out,
        'band_status': 'warn' if any_warn else ('ok' if not any_blocked else 'partial'),
        'band_meta': band_meta,
        'card_cost_pct': as_api_number(cost_pct),
        'card': _card_block_from_wallet(gold_out, silver_out, cfg),
        'benchmark_note': raw_spot.get('benchmark_note'),
        'note': (
            'Customer headline = Cridora wallet (Aani) rate. '
            'Vendor rates are wholesale cost inputs (not shown). '
            + ('Retail-crossing warning active. ' if any_warn else '')
        ),
    }
    if isinstance(raw_spot.get('copper'), dict):
        # Copper is not in the principal band pipeline; pass through raw (unmarginated).
        out['copper'] = copy.deepcopy(raw_spot['copper'])

    if gold_out.get('24K') and silver_out.get('999'):
        _store_last_valid(out)
    return out


def _card_block_from_wallet(gold: dict, silver: dict, cfg=None) -> dict:
    cfg = cfg or _cfg()
    pct = card_cost_pct(cfg)
    return {
        'cost_pct': as_api_number(pct),
        'gold': {
            k: as_api_number(card_rate_from_wallet(v, pct))
            for k, v in (gold or {}).items()
            if isinstance(v, (int, float, Decimal, str)) and to_decimal(v) > ZERO
        },
        'silver': {
            k: as_api_number(card_rate_from_wallet(v, pct))
            for k, v in (silver or {}).items()
            if isinstance(v, (int, float, Decimal, str)) and to_decimal(v) > ZERO
        },
    }


def _detail_for_api(detail: dict) -> dict:
    """JSON-safe band detail (Decimals → float)."""
    out = {}
    for k, v in detail.items():
        if k == 'band' and isinstance(v, dict):
            out[k] = {
                bk: (as_api_number(bv) if isinstance(bv, Decimal) else bv)
                for bk, bv in v.items()
                if bk != 'rate_b_meta'
            }
            if 'rate_b_meta' in v:
                out[k]['rate_b_meta'] = v['rate_b_meta']
        elif isinstance(v, Decimal):
            out[k] = as_api_number(v)
        else:
            out[k] = v
    return out


def get_spot_payload_wallet_ticker(force_refresh: bool = False) -> dict | None:
    """Public entry: Rate A → wallet ticker (band-validated) + card block."""
    from cridora.spot_prices import get_spot_payload_raw_unmarginated

    if not force_refresh:
        cached = cache.get(CACHE_KEY_WALLET_TICKER)
        if cached and isinstance(cached, dict) and cached.get('gold') and cached.get('silver'):
            return cached

    raw = get_spot_payload_raw_unmarginated(force_refresh=force_refresh)
    if not raw:
        held = _last_valid_wallet_payload()
        if held:
            out = copy.deepcopy(held)
            out['source'] = 'last_valid_wallet'
            out['ticker_label'] = 'Cridora wallet (Aani) rate'
            out['pricing_model'] = 'principal_trading_v1'
            return out
        return None
    out = build_wallet_ticker_payload(raw)
    if out and out.get('gold') and out.get('silver'):
        try:
            cache.set(CACHE_KEY_WALLET_TICKER, out, timeout=CACHE_TTL_WALLET_TICKER)
        except Exception:
            pass
    return out


def profit_per_gram(locked_wallet_rate, vendor_landed_cost) -> Decimal:
    """profit_per_gram = locked_wallet − vendor_landed_cost (may be negative; caller enforces floor)."""
    return rate_4dp(to_decimal(locked_wallet_rate) - to_decimal(vendor_landed_cost))


def spread_meets_floor(locked_wallet_rate, vendor_landed_cost, metal: str, cfg=None) -> bool:
    """True when locked_wallet − landed ≥ min_profit_floor for the metal."""
    spread = profit_per_gram(locked_wallet_rate, vendor_landed_cost)
    return spread >= min_profit_floor_aed(metal, cfg)
