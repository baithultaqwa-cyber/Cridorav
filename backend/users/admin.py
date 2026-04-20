from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth import get_user_model

from .models import (
    VendorPricingConfig,
    CatalogProduct,
    PlatformConfig,
    CustomerBankDetails,
    VendorSchedule,
    Order,
    KYCDocument,
    PasswordResetRequest,
    SellOrder,
)

User = get_user_model()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'user_type', 'kyc_status', 'is_active', 'is_staff')
    list_filter = ('user_type', 'kyc_status', 'is_active', 'is_staff')
    search_fields = ('email', 'username', 'first_name', 'last_name', 'vendor_company')
    ordering = ('email',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Cridora', {'fields': ('user_type', 'phone', 'country', 'vendor_company', 'kyc_status', 'kyc_submitted_at', 'kyc_verified_at')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Cridora', {'fields': ('user_type', 'phone', 'country', 'vendor_company')}),
    )


@admin.register(VendorPricingConfig)
class VendorPricingConfigAdmin(admin.ModelAdmin):
    list_display = ('user', 'gold_rate', 'silver_rate', 'updated_at')
    search_fields = ('user__email',)


@admin.register(CatalogProduct)
class CatalogProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'metal', 'weight_grams', 'visible', 'in_stock', 'stock_qty')
    list_filter = ('metal', 'visible', 'in_stock')
    search_fields = ('name', 'vendor__email')


@admin.register(PlatformConfig)
class PlatformConfigAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not PlatformConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustomerBankDetails)
class CustomerBankDetailsAdmin(admin.ModelAdmin):
    list_display = ('user', 'bank_name', 'status', 'updated_at')
    list_filter = ('status',)


@admin.register(VendorSchedule)
class VendorScheduleAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'timezone', 'opening_time', 'closing_time')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'product', 'status', 'total_aed', 'created_at')
    list_filter = ('status',)
    search_fields = ('customer__email', 'product__name')
    raw_id_fields = ('customer', 'product')


@admin.register(SellOrder)
class SellOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'buy_order', 'status', 'net_payout_aed', 'created_at')
    list_filter = ('status',)
    search_fields = ('customer__email',)


@admin.register(KYCDocument)
class KYCDocumentAdmin(admin.ModelAdmin):
    list_display = ('user', 'doc_type', 'status', 'uploaded_at')
    list_filter = ('status', 'doc_type')


@admin.register(PasswordResetRequest)
class PasswordResetRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'created_at')
    list_filter = ('status',)
