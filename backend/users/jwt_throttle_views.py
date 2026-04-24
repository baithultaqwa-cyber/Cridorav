from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenRefreshView


class ThrottledTokenRefreshView(TokenRefreshView):
    """Refresh token endpoint; rate-limited per IP to reduce brute-force abuse."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'token_refresh'
