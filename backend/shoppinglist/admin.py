from django.contrib import admin
from .models import ShoppingList, ShoppingListItem, Cart, CartItem


@admin.register(ShoppingList)
class ShoppingListAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "name", "created_at")
	search_fields = ("name", "user__username")


@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
	list_display = ("id", "shopping_list", "name", "quantity", "unit", "substituted")
	list_filter = ("substituted",)


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "status", "created_at", "updated_at")
	list_filter = ("status",)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
	list_display = ("id", "cart", "name", "quantity", "unit", "checked")


# Register your models here.
