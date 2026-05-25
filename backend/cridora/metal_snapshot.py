"""Persist ticker-equivalent (display-margined) AED/g once per UTC day."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.db import DatabaseError
from django.utils import timezone

from users.models import MetalTickerDailySnapshot

logger = logging.getLogger(__name__)


def _dec(v):
    if v is None:
        return None
    try:
        return Decimal(str(round(float(v), 6)))
    except (TypeError, ValueError):
        return None


def record_margined_ticker_daily_snapshot(payload: dict):
    """Upsert today's row from ``/api/spot-prices/`` shaped payload (margined)."""
    if not isinstance(payload, dict):
        return
    gb = payload.get("gold")
    sb = payload.get("silver")
    if not isinstance(gb, dict) or not isinstance(sb, dict):
        return

    src = ""
    raw_src = payload.get("source")
    if isinstance(raw_src, str) and raw_src.strip():
        src = raw_src.strip()[:48]

    g24 = _dec(gb.get("24K"))
    s999 = _dec(sb.get("999"))
    if g24 is None or g24 <= 0 or s999 is None or s999 <= 0:
        return

    cb = payload.get("copper")
    c999 = _dec(cb.get("999")) if isinstance(cb, dict) else None
    day = timezone.now().date()

    try:
        MetalTickerDailySnapshot.objects.update_or_create(
            snapshot_date=day,
            defaults={
                "gold_24k_aed_per_gram": g24,
                "silver_999_aed_per_gram": s999,
                "copper_999_aed_per_gram": c999 if (c999 is not None and c999 > 0) else None,
                "spot_payload_source": src,
            },
        )
    except DatabaseError as exc:
        logger.warning("metal_ticker_daily_snapshot_failed", extra={"error": str(exc)})


def list_snapshots_between(start_date, end_date):
    return list(
        MetalTickerDailySnapshot.objects.filter(
            snapshot_date__gte=start_date, snapshot_date__lte=end_date
        ).order_by("snapshot_date")
    )
