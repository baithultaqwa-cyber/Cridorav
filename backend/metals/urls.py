from django.urls import path
from .views import MetalListingListView, VendorListView, SpotPriceView

urlpatterns = [
    path('listings/', MetalListingListView.as_view(), name='metal-listings'),
    path('vendors/', VendorListView.as_view(), name='vendors'),
    path('spot-prices/', SpotPriceView.as_view(), name='spot-prices'),
]
