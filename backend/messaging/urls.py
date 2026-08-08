from django.urls import path

from .views import AdminSmsGatewayView

urlpatterns = [
    path('admin/sms-gateway/', AdminSmsGatewayView.as_view(), name='admin-sms-gateway'),
]
