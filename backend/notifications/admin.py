from django.contrib import admin

from .models import AdminBroadcastLog, Notification, PriceAlertState, PushSubscription


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_active', 'created_at', 'last_seen_at')
    list_filter = ('is_active',)
    search_fields = ('user__email', 'endpoint')
    raw_id_fields = ('user',)


@admin.register(AdminBroadcastLog)
class AdminBroadcastLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'kind', 'audience', 'title', 'recipients_count', 'guests_count', 'sent_by')
    list_filter = ('kind', 'audience')
    search_fields = ('title', 'body')
    raw_id_fields = ('sent_by',)
    readonly_fields = ('created_at',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'recipient', 'category', 'title', 'push_sent', 'read_at')
    list_filter = ('category', 'push_sent')
    search_fields = ('recipient__email', 'title', 'body')
    raw_id_fields = ('recipient',)
    readonly_fields = ('created_at',)


@admin.register(PriceAlertState)
class PriceAlertStateAdmin(admin.ModelAdmin):
    list_display = ('metal', 'last_notified_price', 'last_notified_at', 'updated_at')
