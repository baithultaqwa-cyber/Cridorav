from django.urls import path

from .views import (
    AdminVendorKycAccessListView,
    AdminVendorKycAccessView,
    CustomerVendorStatusView,
    VendorCustomerSearchView,
    VendorKycAuditListView,
    VendorOwnAccessView,
    VendorVerificationActionView,
    VendorVerificationListView,
    VendorVerificationRequestView,
)

urlpatterns = [
    path('admin/vendors/', AdminVendorKycAccessListView.as_view(), name='vendor-kyc-admin-list'),
    path(
        'admin/vendors/<int:vendor_id>/access/',
        AdminVendorKycAccessView.as_view(),
        name='vendor-kyc-admin-access',
    ),
    path('vendor/access/', VendorOwnAccessView.as_view(), name='vendor-kyc-own-access'),
    path('vendor/verifications/', VendorVerificationListView.as_view(), name='vendor-kyc-list'),
    path('vendor/customers/search/', VendorCustomerSearchView.as_view(), name='vendor-kyc-search'),
    path(
        'vendor/verifications/<int:customer_id>/request/',
        VendorVerificationRequestView.as_view(),
        name='vendor-kyc-request',
    ),
    path(
        'vendor/verifications/<int:customer_id>/<str:action>/',
        VendorVerificationActionView.as_view(),
        name='vendor-kyc-action',
    ),
    path(
        'customer/vendor-status/<int:vendor_id>/',
        CustomerVendorStatusView.as_view(),
        name='vendor-kyc-customer-status',
    ),
    path('audit/', VendorKycAuditListView.as_view(), name='vendor-kyc-audit'),
]
