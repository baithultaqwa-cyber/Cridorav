"""Thin API for the durable rate ledger (movements + competitor comparisons)."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cridora.rate_ledger import (
    latest_comparison,
    latest_movement,
    matrix_payload_from_ledger,
    spot_payload_from_ledger,
)


def _movement_dict(mov):
    if not mov:
        return None
    return {
        'id': mov.id,
        'captured_at': mov.captured_at.isoformat(),
        'gold_24k': float(mov.gold_24k_aed_per_gram),
        'gold_22k': float(mov.gold_22k_aed_per_gram) if mov.gold_22k_aed_per_gram is not None else None,
        'gold_21k': float(mov.gold_21k_aed_per_gram) if mov.gold_21k_aed_per_gram is not None else None,
        'gold_18k': float(mov.gold_18k_aed_per_gram) if mov.gold_18k_aed_per_gram is not None else None,
        'silver_999': float(mov.silver_999_aed_per_gram),
        'silver_925': float(mov.silver_925_aed_per_gram) if mov.silver_925_aed_per_gram is not None else None,
        'copper_999': float(mov.copper_999_aed_per_gram) if mov.copper_999_aed_per_gram is not None else None,
        'prev_gold_24k': float(mov.prev_gold_24k) if mov.prev_gold_24k is not None else None,
        'prev_silver_999': float(mov.prev_silver_999) if mov.prev_silver_999 is not None else None,
        'gold_delta': float(mov.gold_delta) if mov.gold_delta is not None else None,
        'silver_delta': float(mov.silver_delta) if mov.silver_delta is not None else None,
        'spot_payload_source': mov.spot_payload_source or '',
    }


def _comparison_dict(snap):
    if not snap:
        return None
    return {
        'id': snap.id,
        'captured_at': snap.captured_at.isoformat(),
        'reason': snap.reason,
        'movement_id': snap.movement_id,
        'cridora_reference_24k': float(snap.cridora_reference_24k) if snap.cridora_reference_24k is not None else None,
        'spot_source': snap.spot_source or '',
        'rows': snap.rows if isinstance(snap.rows, list) else [],
    }


class RateLedgerLatestView(APIView):
    """Latest spot + comparison from durable ledger (works when market/feed is closed)."""

    permission_classes = [AllowAny]

    def get(self, request):
        mov = latest_movement()
        snap = latest_comparison()
        return Response({
            'currency': 'AED',
            'unit': 'per_gram',
            'spot': spot_payload_from_ledger(),
            'comparison': matrix_payload_from_ledger(),
            'latest_movement': _movement_dict(mov),
            'latest_comparison': _comparison_dict(snap),
        })


class RateLedgerMovementsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from users.models import MetalRateMovement

        try:
            limit = min(500, max(1, int(request.query_params.get('limit', 100))))
        except (TypeError, ValueError):
            limit = 100
        rows = MetalRateMovement.objects.order_by('-captured_at')[:limit]
        return Response({
            'count': len(rows),
            'results': [_movement_dict(m) for m in rows],
        })


class RateLedgerComparisonsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from users.models import MarketComparisonSnapshot

        try:
            limit = min(200, max(1, int(request.query_params.get('limit', 50))))
        except (TypeError, ValueError):
            limit = 50
        rows = MarketComparisonSnapshot.objects.order_by('-captured_at')[:limit]
        return Response({
            'count': len(rows),
            'results': [_comparison_dict(s) for s in rows],
        })
