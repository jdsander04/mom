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
