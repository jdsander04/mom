from django.db import models
from django.contrib.auth.models import User


class ShoppingList(models.Model):
	"""A user's generated shopping list aggregated from one or more recipes."""
	user = models.ForeignKey(User, on_delete=models.CASCADE)
	name = models.CharField(max_length=255, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)


class ShoppingListItem(models.Model):
	"""An item in a shopping list. Optionally references a recipe ingredient as the source."""
	shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name="items")
	name = models.CharField(max_length=255)
	quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
	unit = models.CharField(max_length=64, blank=True)
	substituted = models.BooleanField(default=False)


class Cart(models.Model):
	"""A cart created from a shopping list that can be edited independently."""
	user = models.ForeignKey(User, on_delete=models.CASCADE)
	shopping_list = models.ForeignKey(ShoppingList, on_delete=models.SET_NULL, null=True, blank=True)
	status = models.CharField(max_length=32, default="open")
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
	name = models.CharField(max_length=255)
	quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
	unit = models.CharField(max_length=64, blank=True)
	checked = models.BooleanField(default=False)
	source_list_item = models.ForeignKey(ShoppingListItem, on_delete=models.SET_NULL, null=True, blank=True)


class CartRecipe(models.Model):
	"""Tracks recipes added to cart with their quantities."""
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="recipes")
	recipe = models.ForeignKey('recipes.Recipe', on_delete=models.CASCADE)
	quantity = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
	created_at = models.DateTimeField(auto_now_add=True)

