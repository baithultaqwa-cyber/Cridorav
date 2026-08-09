"""
Single source of truth for financial Decimal arithmetic.

Policy (exchange-grade, not display-grade):
- All money (AED) is quantized to 0.01 with ROUND_HALF_UP.
- All grams / AED-per-gram rates are quantized to 0.0001 with ROUND_HALF_UP.
- Never use Python float for intermediate money/gram/rate math.
- Convert to float/str only at intentional API/JSON boundaries via as_api_* helpers.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any

AED = Decimal('0.01')
GRAM = Decimal('0.0001')
RATE = Decimal('0.0001')
ZERO = Decimal('0')
HUNDRED = Decimal('100')


def to_decimal(value: Any, *, default: Decimal = ZERO) -> Decimal:
    """Parse any numeric-ish value to Decimal without float()."""
    if value is None or value == '':
        return default
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return Decimal(value)
    try:
        # str() avoids float binary artifacts when value is already a float from JSON.
        # Prefer callers pass str/Decimal/int; float input is last-resort sanitized.
        if isinstance(value, float):
            if value != value or value in (float('inf'), float('-inf')):  # NaN/Inf
                return default
            return Decimal(str(value))
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        return default


def money_aed(value: Any) -> Decimal:
    d = to_decimal(value)
    if d < ZERO:
        d = ZERO
    return d.quantize(AED, rounding=ROUND_HALF_UP)


def grams(value: Any) -> Decimal:
    d = to_decimal(value)
    if d < ZERO:
        d = ZERO
    return d.quantize(GRAM, rounding=ROUND_HALF_UP)


def rate_4dp(value: Any) -> Decimal:
    d = to_decimal(value)
    if d < ZERO:
        d = ZERO
    return d.quantize(RATE, rounding=ROUND_HALF_UP)


def pct_of(amount: Decimal, pct: Any) -> Decimal:
    """amount * pct / 100, quantized to AED."""
    return money_aed(to_decimal(amount) * to_decimal(pct) / HUNDRED)


def mul_money(rate: Any, qty: Any) -> Decimal:
    """rate × quantity → AED (2 dp)."""
    return money_aed(to_decimal(rate) * to_decimal(qty))


def as_api_number(value: Decimal | Any) -> float:
    """
    JSON/API boundary only. After quantize, float is exact for AED (2 dp) and
    rates/grams (4 dp) within marketplace ranges. Prefer as_api_str for ledgers.
    """
    if isinstance(value, Decimal):
        return float(value)
    return float(to_decimal(value))


def as_api_str(value: Decimal | Any, places: int = 2) -> str:
    d = to_decimal(value)
    if places == 4:
        d = d.quantize(RATE, rounding=ROUND_HALF_UP)
    else:
        d = d.quantize(AED, rounding=ROUND_HALF_UP)
    return format(d, 'f')


def money_dict_for_json(payload: dict) -> dict:
    """Recursively convert Decimal values to strings for JSONField / API payloads."""
    out = {}
    for k, v in payload.items():
        if isinstance(v, Decimal):
            out[k] = format(v, 'f')
        elif isinstance(v, dict):
            out[k] = money_dict_for_json(v)
        elif isinstance(v, list):
            out[k] = [
                money_dict_for_json(i) if isinstance(i, dict)
                else (format(i, 'f') if isinstance(i, Decimal) else i)
                for i in v
            ]
        else:
            out[k] = v
    return out
