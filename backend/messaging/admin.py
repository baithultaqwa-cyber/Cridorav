from django.contrib import admin

from .models import SmsProviderConfig


@admin.register(SmsProviderConfig)
class SmsProviderConfigAdmin(admin.ModelAdmin):
    list_display = ('provider', 'enabled', 'from_number', 'updated_at')
    readonly_fields = ('updated_at',)

    def has_add_permission(self, request):
        return not SmsProviderConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
