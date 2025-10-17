from django.db import models
import uuid


# Ingredient model to store ingredient metadata and an optional vector picture
class Ingredient(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	name = models.CharField(max_length=255)
	description = models.TextField(blank=True)
	unit = models.CharField(max_length=64, blank=True)
	amount = models.FloatField(null=True, blank=True)
	# store vector picture as an uploaded file (e.g., SVG or other vector format)
	vector_picture = models.FileField(upload_to='ingredient_vectors/', null=True, blank=True)

	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"{self.name} ({self.id})"



