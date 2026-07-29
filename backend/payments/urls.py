from django.urls import path
from .views import (
    PaymentProvidersListView,
    CheckoutQuoteView,
    AdminPaymentQueueView,
    AdminPaymentInitiateView,
    AdminPaymentConfirmView,
    CustomerStartPaymentView,
    DeliveryFeeQuoteView,
    DeliveryRequestCreateView,
    SellbackQuoteView,
    TrackedAssetListCreateView,
    TrackedAssetDeleteView,
    HandoverEventCreateView,
    TelrWebhookView,
)

urlpatterns = [
    path('providers/', PaymentProvidersListView.as_view()),
    path('checkout-quote/', CheckoutQuoteView.as_view()),
    path('sellback-quote/', SellbackQuoteView.as_view()),
    path('delivery-quote/', DeliveryFeeQuoteView.as_view()),
    path('orders/<int:order_id>/start/', CustomerStartPaymentView.as_view()),
    path('orders/<int:order_id>/delivery/', DeliveryRequestCreateView.as_view()),
    path('orders/<int:order_id>/handover/', HandoverEventCreateView.as_view()),
    path('admin/queue/', AdminPaymentQueueView.as_view()),
    path('admin/<int:txn_id>/initiate/', AdminPaymentInitiateView.as_view()),
    path('admin/<int:txn_id>/confirm/', AdminPaymentConfirmView.as_view()),
    path('tracked-assets/', TrackedAssetListCreateView.as_view()),
    path('tracked-assets/<int:pk>/', TrackedAssetDeleteView.as_view()),
]
