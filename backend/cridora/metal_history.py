"""Public JSON API: historical AED/g indications for marketing tools."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from cridora.metal_history_service import get_metal_history_series


class MetalHistoryView(APIView):
    """GET ?metal=gold|silver|copper&purity=24K|999|...&days=1-365"""

    permission_classes = [AllowAny]

    def get(self, request):
        metal = (request.query_params.get("metal") or "gold").strip().lower()
        purity_raw = request.query_params.get("purity")
        purity = purity_raw.strip() if isinstance(purity_raw, str) else ""
        days_raw = request.query_params.get("days")
        payload = get_metal_history_series(metal, purity, days_raw or 365)
        return Response(payload, status=200)
