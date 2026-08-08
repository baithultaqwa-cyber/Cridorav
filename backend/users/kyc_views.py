from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .kyc_progress import (
    kyc_progress_dict,
    profile_to_dict,
    submit_kyc,
    update_profile_from_data,
)
from .models import KycProfile, User


def _require_customer(request):
    if request.user.user_type != User.CUSTOMER:
        return Response({'detail': 'Customer access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _require_admin(request):
    if request.user.user_type != User.ADMIN:
        return Response({'detail': 'Admin access required.'}, status=status.HTTP_403_FORBIDDEN)
    return None


class KycProgressView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = _require_customer(request)
        if err:
            return err
        progress = kyc_progress_dict(request.user)
        try:
            profile = request.user.kyc_profile
        except KycProfile.DoesNotExist:
            profile = None
        return Response({
            'progress': progress,
            'profile': profile_to_dict(profile),
            'country': request.user.country or '',
        })


class KycProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        err = _require_customer(request)
        if err:
            return err
        from security.validation import validate_kyc_profile
        errors = validate_kyc_profile(request.data if isinstance(request.data, dict) else {})
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        profile = update_profile_from_data(request.user, request.data)
        return Response({
            'progress': kyc_progress_dict(request.user),
            'profile': profile_to_dict(profile),
            'country': request.user.country or '',
        })


class KycSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = _require_customer(request)
        if err:
            return err
        ok, message, profile = submit_kyc(request.user)
        if not ok:
            return Response(
                {'detail': message, 'progress': kyc_progress_dict(request.user)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'detail': message,
            'progress': kyc_progress_dict(request.user),
            'profile': profile_to_dict(profile),
        })


class AdminKycProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        err = _require_admin(request)
        if err:
            return err
        try:
            target = User.objects.get(id=user_id, user_type=User.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            profile = target.kyc_profile
        except KycProfile.DoesNotExist:
            profile = None
        return Response({
            'user_id': target.id,
            'email': target.email or '',
            'phone': target.phone or '',
            'phone_verified': bool(target.phone_verified),
            'country': target.country or '',
            'kyc_status': target.kyc_status,
            'progress': kyc_progress_dict(target),
            'profile': profile_to_dict(profile),
            'aml_result': (profile.aml_result if profile else None) or {},
        })
