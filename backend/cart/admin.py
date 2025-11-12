from django.contrib import admin
from .order_models import OrderHistory

@admin.register(OrderHistory)
class OrderHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_at', 'instacart_url']
    list_filter = ['created_at']
    search_fields = ['user__username']
    readonly_fields = ['created_at']
