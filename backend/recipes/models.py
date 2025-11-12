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

class TrendingRecipe(models.Model):
    """
    Model to store trending recipes fetched from Spoonacular API.
    Recipes are stored by week (year-week format) to allow historical access.
    """
    # Week identifier: format "YYYY-WW" (e.g., "2025-01" for first week of 2025)
    week = models.CharField(max_length=7, db_index=True)
    # Position/rank in the trending list for that week (1-10)
    position = models.PositiveIntegerField()
    
    # Recipe data from Spoonacular
    spoonacular_id = models.IntegerField(unique=True, db_index=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    image_url = models.TextField(blank=True, null=True)
    source_url = models.TextField(blank=True, null=True)
    ready_in_minutes = models.PositiveIntegerField(blank=True, null=True)
    servings = models.PositiveIntegerField(blank=True, null=True)
    
    # Store full recipe data as JSON for flexibility
    recipe_data = models.JSONField(default=dict)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    week_start_date = models.DateField(help_text="Start date of the week (Monday)")
    
    class Meta:
        unique_together = ('week', 'position')
        ordering = ['-week', 'position']
        indexes = [
            models.Index(fields=['week', 'position']),
            models.Index(fields=['-week']),
        ]
    
    def __str__(self):
        return f"{self.title} - Week {self.week} (#{self.position})"
