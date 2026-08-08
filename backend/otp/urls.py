from django.urls import path

from .admin_views import AdminOtpMonitorView
from .views import (
    PasswordResetOtpConfirmView,
    PasswordResetOtpSendView,
    PasswordResetOtpVerifyView,
    PhoneOtpSendView,
    PhoneOtpVerifyView,
    SetPasswordView,
)

urlpatterns = [
    path('admin/challenges/', AdminOtpMonitorView.as_view(), name='otp-admin-challenges'),
    path('phone/send/', PhoneOtpSendView.as_view(), name='otp-phone-send'),
    path('phone/verify/', PhoneOtpVerifyView.as_view(), name='otp-phone-verify'),
    path('reset/send/', PasswordResetOtpSendView.as_view(), name='otp-reset-send'),
    path('reset/verify/', PasswordResetOtpVerifyView.as_view(), name='otp-reset-verify'),
    path('reset/confirm/', PasswordResetOtpConfirmView.as_view(), name='otp-reset-confirm'),
    path('set-password/', SetPasswordView.as_view(), name='otp-set-password'),
]
