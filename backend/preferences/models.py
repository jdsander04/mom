from django.db import models
from django.conf import settings


# Preferences store simple lists of diets and allergens per user.
class Preference(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='preferences')
	# store arrays of strings
	diets = models.JSONField(default=list, blank=True)
	allergens = models.JSONField(default=list, blank=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"Preferences({self.user.username})"
