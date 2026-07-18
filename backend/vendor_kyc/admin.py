from django.contrib import admin

from .models import VendorCustomerVerification, VendorKycAccess, VendorKycAuditLog


@admin.register(VendorKycAccess)
class VendorKycAccessAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'enabled', 'granted_by', 'granted_at', 'updated_at')
    list_filter = ('enabled',)
    search_fields = ('vendor__email', 'vendor__vendor_company')
    raw_id_fields = ('vendor', 'granted_by')


@admin.register(VendorCustomerVerification)
class VendorCustomerVerificationAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'customer', 'status', 'requested_at', 'decided_at')
    list_filter = ('status',)
    search_fields = (
        'vendor__email',
        'vendor__vendor_company',
        'customer__email',
        'customer__phone',
    )
    raw_id_fields = ('vendor', 'customer', 'decided_by')


@admin.register(VendorKycAuditLog)
class VendorKycAuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'vendor', 'customer', 'actor')
    list_filter = ('action',)
    search_fields = ('vendor__email', 'customer__email', 'notes')
    raw_id_fields = ('vendor', 'customer', 'actor')
    readonly_fields = (
        'vendor',
        'customer',
        'actor',
        'action',
        'previous_status',
        'new_status',
        'notes',
        'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
