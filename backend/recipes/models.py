from django.db import models
from django.conf import settings
from django.utils import timezone

# Create your models here.
class Recipe(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField()
    image_url = models.TextField(blank=True, null=True)
    source_url = models.TextField(blank=True, null=True)
    serves = models.PositiveIntegerField(blank=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)
    times_made = models.PositiveIntegerField(default=0)
    favorite = models.BooleanField(default=False)

class Ingredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=100)

class Step(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='steps')
    description = models.TextField()
    order = models.PositiveIntegerField()

class Nutrient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='nutrients')
    macro = models.CharField(max_length=100)
    mass = models.DecimalField(max_digits=10, decimal_places=3)
