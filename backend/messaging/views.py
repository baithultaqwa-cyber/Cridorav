from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SmsProviderConfig
from .sms import public_status


class AdminSmsGatewayView(APIView):
    permission_classes = [IsAuthenticated]

    def _require_admin(self, request):
        if getattr(request.user, 'user_type', None) != 'admin':
            return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def get(self, request):
        err = self._require_admin(request)
        if err:
            return err
        return Response(public_status())

    def patch(self, request):
        err = self._require_admin(request)
        if err:
            return err
        cfg = SmsProviderConfig.get()
        d = request.data if isinstance(request.data, dict) else {}

        if 'provider' in d:
            provider = str(d.get('provider') or '').strip()
            allowed = {c[0] for c in SmsProviderConfig.PROVIDER_CHOICES}
            if provider not in allowed:
                return Response({'detail': 'Unknown SMS provider.'}, status=status.HTTP_400_BAD_REQUEST)
            cfg.provider = provider

        if 'enabled' in d:
            cfg.enabled = bool(d.get('enabled'))

        if 'api_url' in d:
            cfg.api_url = str(d.get('api_url') or '').strip()[:500]

        if 'from_number' in d:
            cfg.from_number = str(d.get('from_number') or '').strip()[:32]

        if 'auth_header' in d:
            cfg.auth_header = str(d.get('auth_header') or 'x-api-key').strip()[:80] or 'x-api-key'

        if 'body_template' in d:
            cfg.body_template = str(d.get('body_template') or '')[:4000]

        if 'extra_headers' in d:
            headers = d.get('extra_headers')
            if headers is None:
                cfg.extra_headers = {}
            elif isinstance(headers, dict):
                cfg.extra_headers = {str(k)[:80]: str(v)[:500] for k, v in headers.items() if k}
            else:
                return Response({'detail': 'extra_headers must be an object.'}, status=status.HTTP_400_BAD_REQUEST)

        # Only replace secrets when a non-empty value is sent. Empty string keeps the current key.
        if d.get('api_key'):
            cfg.api_key = str(d.get('api_key')).strip()[:500]
        if d.get('clear_api_key') is True:
            cfg.api_key = ''
        if d.get('api_secret'):
            cfg.api_secret = str(d.get('api_secret')).strip()[:500]
        if d.get('clear_api_secret') is True:
            cfg.api_secret = ''

        cfg.save()
        return Response(public_status())
