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
    is_trending = models.BooleanField(default=False, help_text="True for trending recipes from Spoonacular")

class Ingredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    name = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=100)
    original_text = models.TextField(blank=True, default='')  # Full ingredient sentence for display

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
    Metadata model for trending recipes fetched from Spoonacular API.
    All recipe data is stored in the linked Recipe model.
    Recipes are stored by week (year-week format) for historical access.
    """
    # Week identifier: format "YYYY-WW" (e.g., "2025-01" for first week of 2025)
    week = models.CharField(max_length=7, db_index=True)
    # Position/rank in the trending list for that week (1-10)
    position = models.PositiveIntegerField()
    
    # Spoonacular identifier
    spoonacular_id = models.IntegerField(unique=True, db_index=True)
    
    # Link to the actual Recipe model (required - all recipe data is in Recipe)
    recipe = models.OneToOneField(
        Recipe,
        on_delete=models.CASCADE,
        related_name='trending_recipe'
    )
    
    # Metadata specific to trending (not in Recipe model)
    ready_in_minutes = models.PositiveIntegerField(blank=True, null=True)
    
    # Store full recipe data as JSON for historical reference and debugging
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
        return f"{self.recipe.name} - Week {self.week} (#{self.position})"
