"""JWT session payload shared by email login, register, and phone OTP."""
from rest_framework_simplejwt.tokens import RefreshToken


def session_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user_type': user.user_type,
        'user_id': user.id,
        'email': user.email or '',
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone': getattr(user, 'phone', '') or '',
        'phone_verified': bool(getattr(user, 'phone_verified', False)),
        'kyc_status': user.kyc_status,
        'vendor_company': user.vendor_company,
        'has_usable_password': user.has_usable_password(),
        'needs_password': not user.has_usable_password(),
    }
