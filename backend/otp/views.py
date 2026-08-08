from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from users.auth_session import session_payload

from .models import OtpChallenge
from .services import (
    GENERIC_OTP_MESSAGE,
    issue_otp,
    make_password_reset_token,
    normalize_email,
    normalize_uae_phone,
    read_password_reset_token,
    verify_otp,
)

User = get_user_model()


def _find_user_by_phone(phone: str):
    qs = User.objects.filter(phone=phone)
    verified = qs.filter(phone_verified=True).first()
    if verified:
        return verified
    return qs.order_by('-id').first()


def _get_or_create_customer_by_phone(phone: str):
    user = _find_user_by_phone(phone)
    if user:
        if not user.phone_verified:
            user.phone = phone
            user.phone_verified = True
            user.save(update_fields=['phone', 'phone_verified'])
        return user, False
    username = phone
    if User.objects.filter(username=username).exists():
        username = f'{phone}-{User.objects.count() + 1}'
    user = User(
        username=username,
        email='',
        phone=phone,
        phone_verified=True,
        user_type=User.CUSTOMER,
        kyc_status=User.KYC_PENDING,
    )
    user.set_unusable_password()
    user.save()
    return user, True


class PhoneOtpSendView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_send'

    def post(self, request):
        phone = normalize_uae_phone(request.data.get('phone', ''))
        if not phone:
            return Response(
                {'detail': 'Enter a valid UAE mobile number (e.g. 05X XXX XXXX).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ok, payload = issue_otp(OtpChallenge.CHANNEL_SMS, OtpChallenge.PURPOSE_LOGIN, phone)
        return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_429_TOO_MANY_REQUESTS)


class PhoneOtpVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        phone = normalize_uae_phone(request.data.get('phone', ''))
        code = request.data.get('code', '')
        if not phone:
            return Response(
                {'detail': 'Enter a valid UAE mobile number.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ok, err = verify_otp(OtpChallenge.CHANNEL_SMS, OtpChallenge.PURPOSE_LOGIN, phone, code)
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        user, created = _get_or_create_customer_by_phone(phone)
        if not user.is_active:
            return Response({'detail': 'Account is disabled.'}, status=status.HTTP_403_FORBIDDEN)
        data = session_payload(user)
        data['created'] = created
        return Response(data, status=status.HTTP_200_OK)


class PasswordResetOtpSendView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_send'

    def post(self, request):
        channel = (request.data.get('channel') or '').strip().lower()
        if channel == 'sms':
            phone = normalize_uae_phone(request.data.get('phone', ''))
            if not phone:
                return Response(
                    {'detail': 'Enter a valid UAE mobile number.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = _find_user_by_phone(phone)
            if user and user.phone_verified:
                ok, payload = issue_otp(OtpChallenge.CHANNEL_SMS, OtpChallenge.PURPOSE_PASSWORD_RESET, phone)
                return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_429_TOO_MANY_REQUESTS)
            return Response({'detail': GENERIC_OTP_MESSAGE, 'ttl_seconds': 600, 'resend_after': 60})

        if channel == 'email':
            email = normalize_email(request.data.get('email', ''))
            if not email:
                return Response({'detail': 'Enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None
            if user:
                ok, payload = issue_otp(OtpChallenge.CHANNEL_EMAIL, OtpChallenge.PURPOSE_PASSWORD_RESET, email)
                return Response(payload, status=status.HTTP_200_OK if ok else status.HTTP_429_TOO_MANY_REQUESTS)
            return Response({'detail': GENERIC_OTP_MESSAGE, 'ttl_seconds': 600, 'resend_after': 60})

        return Response({'detail': 'Choose sms or email.'}, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetOtpVerifyView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp_verify'

    def post(self, request):
        channel = (request.data.get('channel') or '').strip().lower()
        code = request.data.get('code', '')
        if channel == 'sms':
            dest = normalize_uae_phone(request.data.get('phone', ''))
            user = _find_user_by_phone(dest) if dest else None
            ch = OtpChallenge.CHANNEL_SMS
        elif channel == 'email':
            dest = normalize_email(request.data.get('email', ''))
            try:
                user = User.objects.get(email__iexact=dest) if dest else None
            except User.DoesNotExist:
                user = None
            ch = OtpChallenge.CHANNEL_EMAIL
        else:
            return Response({'detail': 'Choose sms or email.'}, status=status.HTTP_400_BAD_REQUEST)
        if not dest:
            return Response({'detail': 'Invalid contact details.'}, status=status.HTTP_400_BAD_REQUEST)
        ok, err = verify_otp(ch, OtpChallenge.PURPOSE_PASSWORD_RESET, dest, code)
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        if not user:
            return Response({'detail': 'Invalid or expired code. Request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'reset_token': make_password_reset_token(user.id)})


class PasswordResetOtpConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_password_reset_confirm'

    def post(self, request):
        token = (request.data.get('reset_token') or '').strip()
        new_password = request.data.get('new_password') or ''
        uid = read_password_reset_token(token)
        if not uid:
            return Response({'detail': 'Invalid or expired reset token.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = User.objects.get(pk=uid)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid or expired reset token.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0] if exc.messages else 'Password is too weak.'}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Your password has been updated. You can sign in with your new password.'})


class SetPasswordView(APIView):
    """First-time password for OTP accounts (unusable password)."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_change_password'

    def post(self, request):
        if request.user.has_usable_password():
            return Response(
                {'detail': 'Use change-password with your current password.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        new_password = request.data.get('new_password') or ''
        if len(new_password) < 8:
            return Response({'detail': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0] if exc.messages else 'Password is too weak.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'detail': 'Password saved. You can use it next time you sign in.', 'needs_password': False})
