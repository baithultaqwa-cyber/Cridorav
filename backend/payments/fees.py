"""Buy / delivery fee calculation helpers (v7 §11)."""
from decimal import Decimal, ROUND_HALF_UP

from users.models import PlatformConfig


TWOPLACES = Decimal('0.01')


def _d(v) -> Decimal:
    return v if isinstance(v, Decimal) else Decimal(str(v))


def round_aed(v) -> Decimal:
    return _d(v).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def buy_fee_breakdown(*, metal_subtotal_aed, provider_key: str = 'manual_aani', cfg=None) -> dict:
    """
    Gold value + Cridora Service Fee (+ optional PSP card fee line).
    Packing/delivery excluded (paid at delivery request).
    """
    cfg = cfg or PlatformConfig.get()
    metal = round_aed(metal_subtotal_aed)
    service = round_aed(metal * _d(cfg.buy_fee_pct) / Decimal('100'))
    psp = Decimal('0.00')
    psp_label = None
    # Approximate card fee disclosure (not charged on Aani). Real Stripe/Telr fees may differ.
    if provider_key in ('stripe', 'telr'):
        pct = _d(getattr(cfg, 'psp_fee_pct', None) or Decimal('2.60'))
        flat = _d(getattr(cfg, 'psp_fee_flat_aed', None) or Decimal('0.50'))
        psp = round_aed(metal * pct / Decimal('100') + flat)
        psp_label = 'Card network / PSP fee (estimate)'
    total = round_aed(metal + service)  # PSP shown separately; not added to principal by default
    return {
        'metal_subtotal_aed': float(metal),
        'cridora_service_fee_aed': float(service),
        'cridora_service_fee_pct': float(cfg.buy_fee_pct),
        'psp_fee_aed': float(psp),
        'psp_fee_label': psp_label,
        'total_due_now_aed': float(total),
        'exclusions_note': 'Delivery and package fee excluded — calculated when you request delivery.',
        'lines': [
            {'key': 'metal', 'label': 'Gold / metal value', 'amount_aed': float(metal)},
            {'key': 'service', 'label': 'Cridora Service Fee', 'amount_aed': float(service)},
            *(
                [{'key': 'psp', 'label': psp_label, 'amount_aed': float(psp)}]
                if psp_label
                else []
            ),
        ],
    }


def delivery_fee_breakdown(*, speed_tier: str, cfg=None) -> dict:
    cfg = cfg or PlatformConfig.get()
    packing = round_aed(cfg.packing_fee_aed)
    if speed_tier == 'priority_sameday':
        delivery = round_aed(cfg.delivery_fee_priority_aed)
        label = 'Priority (same-day) delivery'
    else:
        delivery = round_aed(cfg.delivery_fee_standard_aed)
        label = 'Standard (2-day) delivery'
    total = round_aed(packing + delivery)
    return {
        'packing_fee_aed': float(packing),
        'delivery_fee_aed': float(delivery),
        'delivery_label': label,
        'total_aed': float(total),
        'lines': [
            {'key': 'packing', 'label': 'Packing fee', 'amount_aed': float(packing)},
            {'key': 'delivery', 'label': label, 'amount_aed': float(delivery)},
        ],
    }


def sellback_fee_breakdown(*, gross_aed, cfg=None) -> dict:
    """v7: convenience fee on transaction value — never % of gain."""
    cfg = cfg or PlatformConfig.get()
    gross = round_aed(gross_aed)
    pct_fee = round_aed(gross * _d(cfg.sellback_convenience_fee_pct) / Decimal('100'))
    flat = round_aed(cfg.sellback_convenience_fee_flat_aed)
    fee = round_aed(pct_fee + flat)
    net = round_aed(gross - fee)
    if net < 0:
        net = Decimal('0.00')
    return {
        'gross_buyback_aed': float(gross),
        'convenience_fee_aed': float(fee),
        'net_payout_aed': float(net),
        'lines': [
            {'key': 'gross', 'label': 'Gross buyback amount', 'amount_aed': float(gross)},
            {'key': 'fee', 'label': 'Cridora sell-back convenience fee', 'amount_aed': float(fee)},
            {'key': 'net', 'label': 'Net amount you will receive', 'amount_aed': float(net)},
        ],
        'processing_note': 'Payment is confirmed by the vendor first, then sent to you.',
    }
