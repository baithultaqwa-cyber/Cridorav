from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .selectors import list_otp_monitor


class AdminOtpMonitorView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'user_type', None) != 'admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        data = list_otp_monitor(
            status=(request.query_params.get('status') or '').strip().lower(),
            channel=(request.query_params.get('channel') or '').strip().lower(),
            purpose=(request.query_params.get('purpose') or '').strip().lower(),
            q=request.query_params.get('q') or '',
            limit=request.query_params.get('limit') or 100,
        )
        return Response(data)
