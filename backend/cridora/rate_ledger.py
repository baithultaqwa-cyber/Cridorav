"""
Durable rate ledger — the main historical file for gold/silver movements
and competitor comparison snapshots.

Write path:
  - Every margined spot payload → maybe MetalRateMovement (on change)
  - On rate change → scrape competitors + MarketComparisonSnapshot
  - Every matrix rebuild → snapshot if peer rates moved

Read path:
  - Latest movement / comparison for closed-market last-known rates
  - History APIs for charts / later analytics
"""

from __future__ import annotations

import logging
import threading
from decimal import Decimal

from django.core.cache import cache
from django.db import DatabaseError, transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

# Ignore sub-fils noise from feed jitter.
_CHANGE_EPS = Decimal('0.01')


def _dec(v, places=4):
    if v is None:
        return None
    try:
        return Decimal(str(round(float(v), places)))
    except (TypeError, ValueError):
        return None


def _src(payload: dict) -> str:
    raw = payload.get('source') if isinstance(payload, dict) else None
    if isinstance(raw, str) and raw.strip():
        return raw.strip()[:48]
    return ''


def _rates_from_payload(payload: dict):
    if not isinstance(payload, dict):
        return None
    gb = payload.get('gold') if isinstance(payload.get('gold'), dict) else {}
    sb = payload.get('silver') if isinstance(payload.get('silver'), dict) else {}
    cb = payload.get('copper') if isinstance(payload.get('copper'), dict) else {}
    g24 = _dec(gb.get('24K'))
    s999 = _dec(sb.get('999'))
    if g24 is None or g24 <= 0 or s999 is None or s999 <= 0:
        return None
    return {
        'gold_24k': g24,
        'gold_22k': _dec(gb.get('22K')),
        'gold_21k': _dec(gb.get('21K')),
        'gold_18k': _dec(gb.get('18K')),
        'silver_999': s999,
        'silver_925': _dec(sb.get('925')),
        'copper_999': _dec(cb.get('999'), places=6),
    }


def _changed(prev, nxt) -> bool:
    if prev is None:
        return True
    try:
        return abs(Decimal(prev) - Decimal(nxt)) >= _CHANGE_EPS
    except Exception:
        return True


def latest_movement():
    from users.models import MetalRateMovement

    return MetalRateMovement.objects.order_by('-captured_at').first()


def latest_comparison():
    from users.models import MarketComparisonSnapshot

    return MarketComparisonSnapshot.objects.order_by('-captured_at').first()


def spot_payload_from_ledger():
    """
    Last known public spot payload from durable ledger (market closed / feed down).
    Returns a copy with source overridden to ledger_cache when present.
    """
    mov = latest_movement()
    if not mov:
        return None
    payload = mov.spot_payload if isinstance(mov.spot_payload, dict) else None
    if not payload or not isinstance(payload.get('gold'), dict):
        # Reconstruct minimal payload from columns.
        payload = {
            'currency': 'AED',
            'unit': 'per_gram',
            'gold': {
                '24K': float(mov.gold_24k_aed_per_gram),
            },
            'silver': {
                '999': float(mov.silver_999_aed_per_gram),
            },
        }
        if mov.gold_22k_aed_per_gram is not None:
            payload['gold']['22K'] = float(mov.gold_22k_aed_per_gram)
        if mov.gold_21k_aed_per_gram is not None:
            payload['gold']['21K'] = float(mov.gold_21k_aed_per_gram)
        if mov.gold_18k_aed_per_gram is not None:
            payload['gold']['18K'] = float(mov.gold_18k_aed_per_gram)
        if mov.silver_925_aed_per_gram is not None:
            payload['silver']['925'] = float(mov.silver_925_aed_per_gram)
        if mov.copper_999_aed_per_gram is not None:
            payload['copper'] = {'999': float(mov.copper_999_aed_per_gram)}
    out = dict(payload)
    out['source'] = 'ledger_cache'
    out['ledger_captured_at'] = mov.captured_at.isoformat()
    out['note'] = (
        out.get('note')
        or 'Last recorded ticker rate — live feed unavailable or market closed. '
        'Rates stay until the next price change.'
    )
    return out


def matrix_payload_from_ledger():
    snap = latest_comparison()
    if not snap:
        return None
    payload = snap.matrix_payload if isinstance(snap.matrix_payload, dict) else None
    if payload and payload.get('rows'):
        out = dict(payload)
        out['spot_source'] = out.get('spot_source') or 'ledger_cache'
        out['updated_at'] = snap.captured_at.isoformat()
        out['ledger_captured_at'] = snap.captured_at.isoformat()
        return out
    return {
        'currency': snap.currency or 'AED',
        'unit': snap.unit or 'per_gram',
        'updated_at': snap.captured_at.isoformat(),
        'ledger_captured_at': snap.captured_at.isoformat(),
        'cridora_reference_24k': float(snap.cridora_reference_24k) if snap.cridora_reference_24k is not None else None,
        'spot_source': snap.spot_source or 'ledger_cache',
        'disclaimer': 'Last saved competitor comparison from the rate ledger.',
        'rows': snap.rows if isinstance(snap.rows, list) else [],
    }


@transaction.atomic
def record_movement_if_changed(margined_payload: dict):
    """
    Persist a MetalRateMovement when gold 24K or silver 999 moves.
    Returns the new movement, or None if unchanged / invalid.
    """
    from users.models import MetalRateMovement

    rates = _rates_from_payload(margined_payload)
    if not rates:
        return None

    prev = (
        MetalRateMovement.objects.order_by('-captured_at')
        .only(
            'gold_24k_aed_per_gram',
            'silver_999_aed_per_gram',
        )
        .first()
    )
    if prev and not (
        _changed(prev.gold_24k_aed_per_gram, rates['gold_24k'])
        or _changed(prev.silver_999_aed_per_gram, rates['silver_999'])
    ):
        return None

    prev_g = prev.gold_24k_aed_per_gram if prev else None
    prev_s = prev.silver_999_aed_per_gram if prev else None
    try:
        mov = MetalRateMovement.objects.create(
            gold_24k_aed_per_gram=rates['gold_24k'],
            gold_22k_aed_per_gram=rates['gold_22k'],
            gold_21k_aed_per_gram=rates['gold_21k'],
            gold_18k_aed_per_gram=rates['gold_18k'],
            silver_999_aed_per_gram=rates['silver_999'],
            silver_925_aed_per_gram=rates['silver_925'],
            copper_999_aed_per_gram=rates['copper_999'] if rates['copper_999'] and rates['copper_999'] > 0 else None,
            prev_gold_24k=prev_g,
            prev_silver_999=prev_s,
            gold_delta=(rates['gold_24k'] - prev_g) if prev_g is not None else None,
            silver_delta=(rates['silver_999'] - prev_s) if prev_s is not None else None,
            spot_payload_source=_src(margined_payload),
            spot_payload=margined_payload if isinstance(margined_payload, dict) else {},
        )
        return mov
    except DatabaseError as exc:
        logger.warning('metal_rate_movement_failed', extra={'error': str(exc)})
        return None


def _peer_fingerprint(rows) -> str:
    if not isinstance(rows, list):
        return ''
    parts = []
    for r in rows:
        if not isinstance(r, dict) or r.get('is_cridora'):
            continue
        rid = r.get('id') or ''
        r24 = r.get('rate_24k')
        parts.append(f'{rid}:{r24}')
    return '|'.join(parts)


def record_comparison_snapshot(matrix_payload: dict, *, movement=None, reason='matrix_refresh', force=False):
    """
    Persist a MarketComparisonSnapshot. Skips when peer fingerprint unchanged unless force/rate_change.
    """
    from users.models import MarketComparisonSnapshot

    if not isinstance(matrix_payload, dict):
        return None
    rows = matrix_payload.get('rows')
    if not isinstance(rows, list) or not rows:
        return None

    if not force and reason != MarketComparisonSnapshot.REASON_RATE_CHANGE:
        last = latest_comparison()
        if last and _peer_fingerprint(last.rows) == _peer_fingerprint(rows):
            # Also skip if Cridora ref unchanged.
            try:
                last_ref = last.cridora_reference_24k
                cur_ref = _dec(matrix_payload.get('cridora_reference_24k'))
                if last_ref is not None and cur_ref is not None and not _changed(last_ref, cur_ref):
                    return None
            except Exception:
                pass

    ref = _dec(matrix_payload.get('cridora_reference_24k'))
    try:
        return MarketComparisonSnapshot.objects.create(
            movement=movement,
            reason=reason,
            cridora_reference_24k=ref,
            spot_source=str(matrix_payload.get('spot_source') or '')[:48],
            currency=str(matrix_payload.get('currency') or 'AED')[:8],
            unit=str(matrix_payload.get('unit') or 'per_gram')[:32],
            matrix_payload=matrix_payload,
            rows=rows,
        )
    except DatabaseError as exc:
        logger.warning('market_comparison_snapshot_failed', extra={'error': str(exc)})
        return None


def sync_ledger_from_margined_spot(margined_payload: dict, *, scrape_competitors_on_change=True):
    """
    Main write entry after a public margined spot payload is ready.
    Records movement on change; schedules competitor scrape when rates move.
    """
    from cridora.metal_snapshot import record_margined_ticker_daily_snapshot

    try:
        record_margined_ticker_daily_snapshot(margined_payload)
    except Exception:
        logger.exception('daily_snapshot_from_ledger_sync_failed')

    movement = record_movement_if_changed(margined_payload)
    if movement and scrape_competitors_on_change:
        schedule_comparison_after_rate_change(movement.id)
    return movement


def schedule_comparison_after_rate_change(movement_id: int):
    """Background: rebuild matrix, cache it, archive snapshot linked to the movement."""

    def _run():
        try:
            from users.models import MetalRateMovement
            from cridora.market_matrix import (
                CACHE_KEY_MATRIX,
                CACHE_TTL_MATRIX,
                build_market_matrix,
            )

            movement = MetalRateMovement.objects.filter(id=movement_id).first()
            data = build_market_matrix()
            cache.set(CACHE_KEY_MATRIX, data, timeout=CACHE_TTL_MATRIX)
            record_comparison_snapshot(
                data,
                movement=movement,
                reason='rate_change',
                force=True,
            )
            logger.info(
                'rate_ledger_comparison_after_move',
                extra={'movement_id': movement_id, 'rows': len(data.get('rows') or [])},
            )
        except Exception:
            logger.exception('rate_ledger_comparison_refresh_failed')

    try:
        threading.Thread(target=_run, daemon=True, name='rate-ledger-compare').start()
    except Exception:
        logger.exception('rate_ledger_comparison_thread_failed')


def sync_comparison_from_matrix(matrix_payload: dict, *, reason='matrix_refresh'):
    """Call after a successful live matrix build (API / cron)."""
    return record_comparison_snapshot(matrix_payload, reason=reason, force=False)


def annotate_spot_with_ledger_meta(payload: dict) -> dict:
    """Attach last ledger capture time for clients (closed-market clarity)."""
    if not isinstance(payload, dict):
        return payload
    mov = latest_movement()
    out = dict(payload)
    if mov:
        out.setdefault('ledger_captured_at', mov.captured_at.isoformat())
        out.setdefault('ledger_gold_24k', float(mov.gold_24k_aed_per_gram))
    out.setdefault('server_time', timezone.now().isoformat())
    return out
