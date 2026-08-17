"""
Principal-trading order pricing — lock wallet/card rates, landed cost, profit.

Used by place-order, payment-tier switch, and soft re-quote.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from cridora.money import ZERO, money_aed, mul_money, rate_4dp, to_decimal
from cridora.pricing_engine import (
    best_vendor_landed_cost,
    card_rate_from_wallet,
    get_spot_payload_wallet_ticker,
    profit_per_gram,
    rate_a_for_purity,
    resolve_vendor_landed_cost,
    spread_meets_floor,
)
from payments.fees import buy_fee_breakdown, buy_fee_breakdown_api

TIER_WALLET = 'wallet'
TIER_CARD = 'card'
CARD_PROVIDERS = frozenset({'stripe', 'telr'})


def tier_for_provider(provider_key: str | None) -> str:
    key = (provider_key or '').strip().lower()
    return TIER_CARD if key in CARD_PROVIDERS else TIER_WALLET


@dataclass
class LockedQuote:
    """Snapshot applied onto Order at place / re-quote / tier switch."""
    wallet_rate: Decimal
    card_rate: Decimal
    charged_rate: Decimal  # rate_per_gram customer pays (wallet or card)
    metal_rate: Decimal    # cost basis / portfolio (wallet rate)
    buyback: Decimal
    vendor_landed_cost: Decimal | None
    best_vendor_id: int | None
    profit_per_gram: Decimal | None
    payment_tier: str
    metal_subtotal: Decimal
    platform_fee: Decimal
    total: Decimal
    fees_breakdown: dict
    floor_ok: bool
    floor_block_reason: str | None = None


def _wallet_rate_for_product(product) -> Decimal:
    """Published wallet ticker for gold/silver; else product effective rate."""
    metal = (product.metal or '').lower()
    if metal in ('gold', 'silver'):
        try:
            from cridora.spot_prices import gold_rate_for_purity_tier, silver_rate_for_purity_tier

            wallet = get_spot_payload_wallet_ticker()
            if wallet:
                if metal == 'gold' and wallet.get('gold'):
                    t = gold_rate_for_purity_tier(wallet['gold'], product.purity)
                else:
                    t = silver_rate_for_purity_tier(wallet.get('silver') or {}, product.purity)
                if t is not None and to_decimal(t) > ZERO:
                    return rate_4dp(t)
        except Exception:
            pass
    return rate_4dp(product.effective_rate())


def _landed_for_product(product, cfg=None) -> tuple[Decimal | None, int | None]:
    """Best vendor landed cost for this metal/purity; prefer product vendor when available."""
    metal = (product.metal or '').lower()
    if metal not in ('gold', 'silver'):
        return None, None

    from cridora.spot_prices import get_spot_payload_raw_unmarginated

    raw = get_spot_payload_raw_unmarginated()
    rate_a = rate_a_for_purity(metal, product.purity, raw) if raw else None
    if rate_a is None or rate_a <= ZERO:
        return None, None

    # Prefer the listing vendor's agreed wholesale cost when Auto/manual configured.
    product_vendor_cost = None
    try:
        vpc = product.vendor.pricing_config
        product_vendor_cost = resolve_vendor_landed_cost(vpc, metal, product.purity, rate_a)
    except Exception:
        product_vendor_cost = None

    best, best_vid = best_vendor_landed_cost(metal, product.purity, rate_a)

    # Route preference: listing vendor if their cost is within floor of best; else best.
    if product_vendor_cost is not None and product_vendor_cost > ZERO:
        if best is None or product_vendor_cost <= best:
            return rate_4dp(product_vendor_cost), product.vendor_id
        # Listing vendor more expensive than best — still lock listing for fulfilment
        # identity, but record best for replenishment reference.
        return rate_4dp(product_vendor_cost), product.vendor_id

    return (rate_4dp(best) if best else None), best_vid


def build_locked_quote(
    *,
    product,
    qty_grams,
    provider_key: str = 'manual_aani',
    cfg=None,
    enforce_floor: bool = True,
) -> LockedQuote:
    """
    Build a principal-trading quote.

    Customer metal charge = wallet (Aani) or card_rate (Stripe/Telr).
    Portfolio cost basis always = wallet_rate.
    """
    from users.models import PlatformConfig

    cfg = cfg or PlatformConfig.get()
    qty = to_decimal(qty_grams)
    wallet = _wallet_rate_for_product(product)
    # All-in packaging etc. still on product; metal principal is wallet/card.
    # Use wallet as metal rate; if product has fees in final_rate, preserve delta.
    final_all_in = rate_4dp(product.final_rate_per_gram())
    effective = rate_4dp(product.effective_rate())
    fee_delta = ZERO
    if final_all_in > ZERO and effective > ZERO and final_all_in > effective:
        fee_delta = rate_4dp(final_all_in - effective)

    if wallet <= ZERO:
        wallet = effective if effective > ZERO else final_all_in

    card = card_rate_from_wallet(wallet, getattr(cfg, 'card_cost_pct', None))
    tier = tier_for_provider(provider_key)
    charged_metal = card if tier == TIER_CARD else wallet
    charged_all_in = rate_4dp(charged_metal + fee_delta)

    landed, vendor_id = _landed_for_product(product, cfg=cfg)
    ppg = profit_per_gram(wallet, landed) if landed is not None else None

    floor_ok = True
    floor_reason = None
    metal = (product.metal or '').lower()
    if enforce_floor and metal in ('gold', 'silver') and landed is not None:
        if not spread_meets_floor(wallet, landed, metal, cfg=cfg):
            floor_ok = False
            floor_reason = (
                f'Spread {ppg} AED/g below min profit floor for {metal}. Re-quote required.'
            )

    buyback = rate_4dp(product.effective_buyback_per_gram())
    metal_sub = mul_money(charged_all_in, qty)
    breakdown = buy_fee_breakdown(metal_subtotal_aed=metal_sub, provider_key=provider_key, cfg=cfg)
    # Card tier: card_rate already embeds acquiring cost — do not also add psp estimate to total.
    # Keep psp as disclosure line only (existing behaviour).

    return LockedQuote(
        wallet_rate=rate_4dp(wallet),
        card_rate=rate_4dp(card),
        charged_rate=charged_all_in,
        metal_rate=rate_4dp(wallet),
        buyback=buyback,
        vendor_landed_cost=rate_4dp(landed) if landed is not None else None,
        best_vendor_id=vendor_id,
        profit_per_gram=rate_4dp(ppg) if ppg is not None else None,
        payment_tier=tier,
        metal_subtotal=breakdown['metal_subtotal_aed'],
        platform_fee=breakdown['cridora_service_fee_aed'],
        total=breakdown['total_due_now_aed'],
        fees_breakdown=buy_fee_breakdown_api(
            metal_subtotal_aed=metal_sub, provider_key=provider_key, cfg=cfg
        ),
        floor_ok=floor_ok,
        floor_block_reason=floor_reason,
    )


def apply_quote_to_order(order, quote: LockedQuote, *, provider_key: str | None = None) -> list[str]:
    """Write quote fields onto order instance (caller saves). Returns update_fields list."""
    order.rate_per_gram = quote.charged_rate
    order.metal_rate_per_gram = quote.metal_rate if quote.metal_rate > ZERO else quote.charged_rate
    order.buyback_per_gram = quote.buyback
    order.platform_fee_aed = quote.platform_fee
    order.total_aed = quote.total
    order.fees_breakdown = quote.fees_breakdown
    order.wallet_rate_per_gram = quote.wallet_rate
    order.card_rate_per_gram = quote.card_rate
    order.payment_tier = quote.payment_tier
    order.vendor_landed_cost_per_gram = quote.vendor_landed_cost
    order.profit_per_gram = quote.profit_per_gram
    order.replenishment_vendor_id = quote.best_vendor_id
    fields = [
        'rate_per_gram', 'metal_rate_per_gram', 'buyback_per_gram',
        'platform_fee_aed', 'total_aed', 'fees_breakdown',
        'wallet_rate_per_gram', 'card_rate_per_gram', 'payment_tier',
        'vendor_landed_cost_per_gram', 'profit_per_gram', 'replenishment_vendor_id',
    ]
    if provider_key is not None:
        order.payment_provider = provider_key
        fields.append('payment_provider')
    return fields


def preview_checkout_quote(*, order, provider_key: str, cfg=None) -> dict[str, Any]:
    """
    Preview totals if customer switches payment rail (wallet ↔ card).
    Does not mutate the order.
    """
    from users.models import PlatformConfig
    from cridora.money import as_api_number

    cfg = cfg or PlatformConfig.get()
    quote = build_locked_quote(
        product=order.product,
        qty_grams=order.qty_grams,
        provider_key=provider_key,
        cfg=cfg,
        enforce_floor=True,
    )
    return {
        'payment_tier': quote.payment_tier,
        'provider_key': provider_key,
        'wallet_rate_per_gram': as_api_number(quote.wallet_rate),
        'card_rate_per_gram': as_api_number(quote.card_rate),
        'rate_per_gram': as_api_number(quote.charged_rate),
        'metal_subtotal_aed': as_api_number(quote.metal_subtotal),
        'cridora_service_fee_aed': as_api_number(quote.platform_fee),
        'total_due_now_aed': as_api_number(quote.total),
        'profit_per_gram': as_api_number(quote.profit_per_gram) if quote.profit_per_gram is not None else None,
        'vendor_landed_cost_per_gram': (
            as_api_number(quote.vendor_landed_cost) if quote.vendor_landed_cost is not None else None
        ),
        'floor_ok': quote.floor_ok,
        'floor_block_reason': quote.floor_block_reason,
        'fees_breakdown': quote.fees_breakdown,
        'note': (
            'Card rate becomes the headline when card is selected — no separate card fee line.'
            if quote.payment_tier == TIER_CARD
            else 'Wallet (Aani) rate is the headline price.'
        ),
    }
