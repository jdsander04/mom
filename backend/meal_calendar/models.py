from django.db import models
from django.conf import settings

class MealPlan(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date = models.DateField()
    breakfast = models.JSONField(default=list)
    lunch = models.JSONField(default=list)
    dinner = models.JSONField(default=list)
    snacks = models.JSONField(default=list)
    
    class Meta:
        unique_together = ('user', 'date')
