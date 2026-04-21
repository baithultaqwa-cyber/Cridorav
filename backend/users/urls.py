from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, RegisterView, MeView, LogoutView,
    CustomerDashboardView, VendorDashboardView, AdminDashboardView,
    VendorApplyView,
    AdminKYCActionView, AdminKYBActionView, AdminFreezeUserView,
    MyDocumentsView, DocumentUploadView, KYCDocumentFileView,
    AdminUserDocumentsView, AdminDocumentReviewView, AdminVerifyAllDocumentsView,
    VendorPricingView, VendorPriceFeedFetchView,
    VendorCatalogView, VendorCatalogDetailView,
    PublicMarketplaceView,
    CustomerBankDetailsView,
    UpdateProfileView,
    AdminBankDetailsView,
    AdminPlatformFeeView,
    CustomerPlaceOrderView, CustomerOrderView,
    VendorPendingOrdersView, VendorOrderActionView,
    VendorScheduleView, VendorPortfolioView,
    CustomerCreateSellOrderView, CustomerSellOrderStatusView,
    VendorPendingSellOrdersView, VendorSellOrderActionView,
    AdminPendingSellOrdersView, AdminSellOrderApproveView,
    ChangePasswordView, ForgotPasswordView, AdminPasswordRequestsView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('vendor/apply/', VendorApplyView.as_view(), name='vendor-apply'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    path('dashboard/customer/', CustomerDashboardView.as_view(), name='dashboard-customer'),
    path('dashboard/vendor/', VendorDashboardView.as_view(), name='dashboard-vendor'),
    path('dashboard/admin/', AdminDashboardView.as_view(), name='dashboard-admin'),

    path('admin/kyc/<int:user_id>/<str:action>/', AdminKYCActionView.as_view(), name='admin-kyc-action'),
    path('admin/kyb/<int:user_id>/<str:action>/', AdminKYBActionView.as_view(), name='admin-kyb-action'),
    path('admin/user/<int:user_id>/<str:action>/', AdminFreezeUserView.as_view(), name='admin-freeze-user'),

    path('documents/<int:doc_id>/file/', KYCDocumentFileView.as_view(), name='kyc-document-file'),
    path('documents/', MyDocumentsView.as_view(), name='my-documents'),
    path('documents/upload/', DocumentUploadView.as_view(), name='document-upload'),
    path('admin/documents/<int:user_id>/verify-all/', AdminVerifyAllDocumentsView.as_view(), name='admin-verify-all-documents'),
    path('admin/documents/<int:user_id>/', AdminUserDocumentsView.as_view(), name='admin-user-documents'),
    path('admin/documents/<int:doc_id>/<str:action>/', AdminDocumentReviewView.as_view(), name='admin-doc-review'),

    path('vendor/pricing/', VendorPricingView.as_view(), name='vendor-pricing'),
    path('vendor/pricing/fetch-feed/', VendorPriceFeedFetchView.as_view(), name='vendor-price-feed-fetch'),
    path('vendor/catalog/', VendorCatalogView.as_view(), name='vendor-catalog'),
    path('vendor/catalog/<int:pk>/', VendorCatalogDetailView.as_view(), name='vendor-catalog-detail'),

    path('marketplace/', PublicMarketplaceView.as_view(), name='public-marketplace'),

    path('bank-details/', CustomerBankDetailsView.as_view(), name='customer-bank-details'),
    path('profile/update/', UpdateProfileView.as_view(), name='profile-update'),
    path('admin/bank-details/<int:user_id>/', AdminBankDetailsView.as_view(), name='admin-bank-details'),
    path('admin/bank-details/<int:user_id>/<str:action>/', AdminBankDetailsView.as_view(), name='admin-bank-details-action'),
    path('admin/platform-config/', AdminPlatformFeeView.as_view(), name='admin-platform-config'),

    path('orders/place/', CustomerPlaceOrderView.as_view(), name='order-place'),
    path('orders/<int:order_id>/', CustomerOrderView.as_view(), name='order-detail'),

    path('vendor/pending-orders/', VendorPendingOrdersView.as_view(), name='vendor-pending-orders'),
    path('vendor/orders/<int:order_id>/<str:action>/', VendorOrderActionView.as_view(), name='vendor-order-action'),
    path('vendor/schedule/', VendorScheduleView.as_view(), name='vendor-schedule'),
    path('vendor/portfolio/', VendorPortfolioView.as_view(), name='vendor-portfolio'),

    path('sell-orders/', CustomerCreateSellOrderView.as_view(), name='sell-order-create'),
    path('sell-orders/<int:sell_order_id>/', CustomerSellOrderStatusView.as_view(), name='sell-order-status'),
    path('vendor/sell-orders/', VendorPendingSellOrdersView.as_view(), name='vendor-sell-orders'),
    path('vendor/sell-orders/<int:sell_order_id>/<str:action>/', VendorSellOrderActionView.as_view(), name='vendor-sell-order-action'),
    path('admin/sell-orders/', AdminPendingSellOrdersView.as_view(), name='admin-sell-orders'),
    path('admin/sell-orders/<int:sell_order_id>/<str:action>/', AdminSellOrderApproveView.as_view(), name='admin-sell-order-approve'),

    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('admin/password-requests/', AdminPasswordRequestsView.as_view(), name='admin-password-requests'),
    path('admin/password-requests/<int:request_id>/', AdminPasswordRequestsView.as_view(), name='admin-password-request-resolve'),
]
