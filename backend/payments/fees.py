"""Buy / delivery fee calculation helpers (v7 §11) — Decimal end-to-end."""
from decimal import Decimal

from cridora.money import money_aed, money_dict_for_json, mul_money, pct_of, to_decimal
from users.models import PlatformConfig


def round_aed(v) -> Decimal:
    return money_aed(v)


def buy_fee_breakdown(*, metal_subtotal_aed, provider_key: str = 'manual_aani', cfg=None) -> dict:
    """
    Gold value + Cridora Service Fee (+ optional PSP card fee line).
    Packing/delivery excluded (paid at delivery request).

    Returns Decimal amounts. Use buy_fee_breakdown_api(...) for JSON/API payloads.
    """
    cfg = cfg or PlatformConfig.get()
    metal = money_aed(metal_subtotal_aed)
    service = pct_of(metal, cfg.buy_fee_pct)
    psp = Decimal('0.00')
    psp_label = None
    # Approximate card fee disclosure (not charged on Aani). Real Stripe/Telr fees may differ.
    if provider_key in ('stripe', 'telr'):
        pct = to_decimal(getattr(cfg, 'psp_fee_pct', None) or Decimal('2.60'))
        flat = money_aed(getattr(cfg, 'psp_fee_flat_aed', None) or Decimal('0.50'))
        psp = money_aed(pct_of(metal, pct) + flat)
        psp_label = 'Card network / PSP fee (estimate)'
    total = money_aed(metal + service)  # PSP shown separately; not added to principal by default
    return {
        'metal_subtotal_aed': metal,
        'cridora_service_fee_aed': service,
        'cridora_service_fee_pct': to_decimal(cfg.buy_fee_pct),
        'psp_fee_aed': psp,
        'psp_fee_label': psp_label,
        'total_due_now_aed': total,
        'exclusions_note': 'Delivery and package fee excluded — calculated when you request delivery.',
        'lines': [
            {'key': 'metal', 'label': 'Gold / metal value', 'amount_aed': metal},
            {'key': 'service', 'label': 'Cridora Service Fee', 'amount_aed': service},
            *(
                [{'key': 'psp', 'label': psp_label, 'amount_aed': psp}]
                if psp_label
                else []
            ),
        ],
    }


def buy_fee_breakdown_api(*, metal_subtotal_aed, provider_key: str = 'manual_aani', cfg=None) -> dict:
    """JSON-safe fee breakdown (Decimal → string) for Order.fees_breakdown / API."""
    return money_dict_for_json(
        buy_fee_breakdown(metal_subtotal_aed=metal_subtotal_aed, provider_key=provider_key, cfg=cfg)
    )


def delivery_fee_breakdown(*, speed_tier: str, cfg=None) -> dict:
    cfg = cfg or PlatformConfig.get()
    packing = money_aed(cfg.packing_fee_aed)
    if speed_tier == 'priority_sameday':
        delivery = money_aed(cfg.delivery_fee_priority_aed)
        label = 'Priority (same-day) delivery'
    else:
        delivery = money_aed(cfg.delivery_fee_standard_aed)
        label = 'Standard (2-day) delivery'
    total = money_aed(packing + delivery)
    return money_dict_for_json({
        'packing_fee_aed': packing,
        'delivery_fee_aed': delivery,
        'delivery_label': label,
        'total_aed': total,
        'lines': [
            {'key': 'packing', 'label': 'Packing fee', 'amount_aed': packing},
            {'key': 'delivery', 'label': label, 'amount_aed': delivery},
        ],
    })


def sellback_fee_breakdown(*, gross_aed, cfg=None) -> dict:
    """v7: convenience fee on transaction value — never % of gain."""
    cfg = cfg or PlatformConfig.get()
    gross = money_aed(gross_aed)
    pct_fee = pct_of(gross, cfg.sellback_convenience_fee_pct)
    flat = money_aed(cfg.sellback_convenience_fee_flat_aed)
    fee = money_aed(pct_fee + flat)
    net = money_aed(gross - fee)
    if net < 0:
        net = Decimal('0.00')
    return {
        'gross_buyback_aed': gross,
        'convenience_fee_aed': fee,
        'net_payout_aed': net,
        'lines': [
            {'key': 'gross', 'label': 'Gross buyback amount', 'amount_aed': gross},
            {'key': 'fee', 'label': 'Cridora sell-back convenience fee', 'amount_aed': fee},
            {'key': 'net', 'label': 'Net amount you will receive', 'amount_aed': net},
        ],
        'processing_note': 'Payment is confirmed by the vendor first, then sent to you.',
    }


def sellback_fee_breakdown_api(*, gross_aed, cfg=None) -> dict:
    return money_dict_for_json(sellback_fee_breakdown(gross_aed=gross_aed, cfg=cfg))
