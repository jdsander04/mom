from django.conf import settings
from django.db import models


class DietaryPreference(models.Model):
	"""A simple dietary preference belonging to a user."""
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
	name = models.CharField(max_length=150)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:  # pragma: no cover - trivial
		return f"Pref({self.name})"


class DietaryRestriction(models.Model):
	"""A simple dietary restriction belonging to a user."""
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
	name = models.CharField(max_length=150)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:  # pragma: no cover - trivial
		return f"Rest({self.name})"


class DietSuggestion(models.Model):
    """
    Preset supported diets stored in a dedicated table named 'dietSuggestions'.
    Used by the diet_suggestions endpoint.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dietSuggestions'
        ordering = ['name']

    def __str__(self):
        return self.name


class IngredientSuggestion(models.Model):
    """
    Preset supported ingredients stored in a dedicated table named 'ingredientSuggestions'.
    Used by the ingredient_suggestions endpoint.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ingredientSuggestions'
        ordering = ['name']

    def __str__(self):
        return self.name
