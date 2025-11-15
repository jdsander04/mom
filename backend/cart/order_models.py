from django.db import models
from django.conf import settings


class OrderHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    instacart_url = models.URLField(max_length=500, blank=True, null=True)
    items_data = models.JSONField()
    recipe_names = models.JSONField(default=list)
    top_recipe_image = models.URLField(max_length=500, blank=True, null=True)
    nutrition_data = models.JSONField(default=dict)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']