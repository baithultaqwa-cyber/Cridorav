from django.contrib import admin

from .models import OtpChallenge


@admin.register(OtpChallenge)
class OtpChallengeAdmin(admin.ModelAdmin):
    list_display = ('channel', 'purpose', 'destination', 'attempts', 'sent_ok', 'outcome', 'expires_at', 'consumed_at', 'created_at')
    list_filter = ('channel', 'purpose', 'outcome', 'sent_ok')
    search_fields = ('destination',)
    readonly_fields = ('code_hash', 'created_at')
