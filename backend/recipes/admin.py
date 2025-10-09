from django.contrib import admin
from .models import Recipe, Ingredient, Step, Nutrient

admin.site.register(Recipe)
admin.site.register(Ingredient)
admin.site.register(Step)
admin.site.register(Nutrient)
