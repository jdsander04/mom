from django.db import models
from django.conf import settings


class Allergy(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.user.username} - {self.name}"


class Nutrient(models.Model):
    # Nutrient is a global catalog of nutrients tracked by the app.
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Nutrient: {self.name}"



class UserNutrient(models.Model):
    """Per-user nutrient value linking a user to a global Nutrient."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    nutrient = models.ForeignKey(Nutrient, on_delete=models.CASCADE, related_name='user_values')
    value = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)

    class Meta:
        unique_together = (('user', 'nutrient'),)

    def __str__(self):
        return f"{self.user.username} - {self.nutrient.name}: {self.value}"


class Budget(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    weekly_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.user.username} - Budget"
    
    @classmethod
    def get_weekly_spent(cls, user):
        """Calculate total spent from past week's order history."""
        from cart.order_models import OrderHistory
        from datetime import timedelta
        from django.db.models import Sum
        from django.utils import timezone
        
        week_ago = timezone.now() - timedelta(days=7)
        total = OrderHistory.objects.filter(
            user=user,
            created_at__gte=week_ago,
            total_price__isnull=False
        ).aggregate(total=Sum('total_price'))['total']
        
        return float(total or 0)


class UserNutritionSnapshot(models.Model):
    """Stores an aggregated snapshot of a user's nutrient totals at a point in time.

    `data` is a JSON mapping nutrient/macro name -> total mass (float).
    `total_calories` stores a convenience value if calories are tracked as a nutrient.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    data = models.JSONField(default=dict)
    total_calories = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - Nutrition snapshot @ {self.created_at.isoformat()}"

    @classmethod
    def compute_for_user(cls, user):
        """Compute aggregated nutrient totals for a user from past week's order history.

        Returns a dict: { 'totals': {macro: float}, 'calories': float }
        """
        
        from cart.order_models import OrderHistory
        from datetime import timedelta
        from django.utils import timezone

        # Get orders from the past week
        week_ago = timezone.now() - timedelta(days=7)
        recent_orders = OrderHistory.objects.filter(
            user=user,
            created_at__gte=week_ago
        )

        totals = {}
        for order in recent_orders:
            nutrition_data = order.nutrition_data or {}
            for macro, value in nutrition_data.items():
                if macro in totals:
                    totals[macro] += float(value)
                else:
                    totals[macro] = float(value)

        # try to find calories/energy in macros (case-insensitive)
        calories = 0.0
        for k, v in totals.items():
            if k and k.strip().lower() in ('calories', 'energy', 'kcal'):
                calories = float(v)
                break

        return {'totals': totals, 'calories': calories}

    @classmethod
    def compute_and_save(cls, user):
        res = cls.compute_for_user(user)
        snap = cls.objects.create(user=user, data=res['totals'], total_calories=res['calories'])
        return snap
