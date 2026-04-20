import requests as http_requests
from django.core.cache import cache
from rest_framework import generics, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import MetalListing, Vendor
from .serializers import MetalListingSerializer, VendorSerializer

TROY_OZ_TO_GRAMS = 31.1035

GOLD_KARAT_PURITY = {
    "24K": 1.0,
    "22K": 0.9167,
    "21K": 0.8750,
    "18K": 0.7500,
}

SILVER_FINENESS = {
    "999": 1.0,
    "925": 0.925,
}


class MetalListingListView(generics.ListAPIView):
    serializer_class = MetalListingSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'vendor__name', 'metal']
    ordering_fields = ['rate_per_gram', 'rating', 'created_at']

    def get_queryset(self):
        qs = MetalListing.objects.select_related('vendor').all()
        metal = self.request.query_params.get('metal')
        if metal:
            qs = qs.filter(metal=metal)
        return qs


class VendorListView(generics.ListAPIView):
    queryset = Vendor.objects.filter(is_verified=True)
    serializer_class = VendorSerializer


class SpotPriceView(APIView):
    def get(self, request):
        cached = cache.get("spot_prices")
        if cached:
            return Response(cached)

        try:
            gold_resp = http_requests.get(
                "https://api.gold-api.com/price/XAU", timeout=5
            )
            silver_resp = http_requests.get(
                "https://api.gold-api.com/price/XAG", timeout=5
            )
        except http_requests.RequestException:
            return Response(
                {"error": "Price feed unavailable"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        if gold_resp.status_code != 200 or silver_resp.status_code != 200:
            return Response(
                {"error": "Price feed unavailable"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        gold_usd_per_oz = gold_resp.json()["price"]
        silver_usd_per_oz = silver_resp.json()["price"]

        # AED is permanently pegged to USD at 3.6725 since 1997
        usd_to_aed = 3.6725

        gold_per_gram_aed = (gold_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_to_aed
        silver_per_gram_aed = (silver_usd_per_oz / TROY_OZ_TO_GRAMS) * usd_to_aed

        data = {
            "currency": "AED",
            "unit": "per_gram",
            "usd_to_aed": usd_to_aed,
            "gold": {
                karat: round(gold_per_gram_aed * purity, 2)
                for karat, purity in GOLD_KARAT_PURITY.items()
            },
            "silver": {
                fineness: round(silver_per_gram_aed * purity, 3)
                for fineness, purity in SILVER_FINENESS.items()
            },
        }

        cache.set("spot_prices", data, timeout=600)
        return Response(data)
