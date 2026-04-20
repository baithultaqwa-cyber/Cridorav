from django.contrib import admin
from .models import Vendor, MetalListing


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_verified', 'country', 'created_at']
    list_filter = ['is_verified']
    search_fields = ['name']


@admin.register(MetalListing)
class MetalListingAdmin(admin.ModelAdmin):
    list_display = ['name', 'metal', 'vendor', 'rate_per_gram', 'total_grams', 'in_stock', 'rating']
    list_filter = ['metal', 'in_stock', 'vat_included']
    search_fields = ['name', 'vendor__name']
    readonly_fields = ['created_at', 'updated_at']
