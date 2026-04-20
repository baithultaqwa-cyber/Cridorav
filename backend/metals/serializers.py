from rest_framework import serializers
from .models import Vendor, MetalListing


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = ['id', 'name', 'is_verified', 'country']


class MetalListingSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    vendor_verified = serializers.BooleanField(source='vendor.is_verified', read_only=True)
    total_price = serializers.FloatField(read_only=True)

    class Meta:
        model = MetalListing
        fields = [
            'id', 'name', 'short_desc', 'metal', 'image_url',
            'rate_per_gram', 'total_grams', 'vat_included',
            'buyback_per_gram', 'in_stock', 'badge', 'rating',
            'review_count', 'vendor_name', 'vendor_verified', 'total_price',
        ]
