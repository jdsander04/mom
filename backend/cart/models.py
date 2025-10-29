from django.db import models
from django.conf import settings


class Cart(models.Model):
	"""User's cart containing recipes and individual ingredients."""
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)


class CartRecipe(models.Model):
	"""Recipe in cart with customizable serving size."""
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="recipes")
	recipe = models.ForeignKey('recipes.Recipe', on_delete=models.CASCADE)
	serving_size = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
	created_at = models.DateTimeField(auto_now_add=True)


class CartItem(models.Model):
	"""Individual ingredient in cart with customizable quantity."""
	cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
	name = models.CharField(max_length=255)
	quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0)
	unit = models.CharField(max_length=64, blank=True)
	recipe_ingredient = models.ForeignKey('recipes.Ingredient', on_delete=models.CASCADE)

	def __str__(self):
		return f"{self.name} ({self.quantity} {self.unit})"
