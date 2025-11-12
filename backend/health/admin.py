from django.contrib import admin
from .models import Allergy, Nutrient, UserNutrient, Budget, UserNutritionSnapshot

## Duplicate block below -- keep only the most up-to-date/feature-rich versions
#@admin.register(Nutrient)
#class NutrientAdmin(admin.ModelAdmin):
#    list_display = ('name', 'description')
#    search_fields = ('name',)
#
#@admin.register(UserNutrient)
#class UserNutrientAdmin(admin.ModelAdmin):
#    list_display = ('user', 'nutrient', 'value')
#    list_filter = ('nutrient', 'user')
#    search_fields = ('user__username', 'nutrient__name')
#    raw_id_fields = ('user', 'nutrient')
#    ordering = ('user', 'nutrient')
#
#@admin.register(UserNutritionSnapshot)
#class UserNutritionSnapshotAdmin(admin.ModelAdmin):
#    list_display = ('user', 'total_calories', 'created_at')
#    readonly_fields = ('data', 'total_calories', 'created_at')
#    list_filter = ('created_at', 'user')
#    search_fields = ('user__username',)
#
#@admin.register(Allergy)
#class AllergyAdmin(admin.ModelAdmin):
#    list_display = ('user', 'name')
#    search_fields = ('name', 'user__username')
#
#@admin.register(Budget)
#class BudgetAdmin(admin.ModelAdmin):
#    list_display = ('user', 'weekly_budget', 'spent')
#    raw_id_fields = ('user',)
from django.contrib import admin
from .models import Allergy, Nutrient, UserNutrient, Budget, UserNutritionSnapshot

# Most up-to-date admin registrations below:
@admin.register(Nutrient)
class NutrientAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(UserNutrient)
class UserNutrientAdmin(admin.ModelAdmin):
    list_display = ('user', 'nutrient', 'value')
    list_filter = ('nutrient', 'user')
    search_fields = ('user__username', 'nutrient__name')
    raw_id_fields = ('user', 'nutrient')
    ordering = ('user', 'nutrient')

@admin.register(UserNutritionSnapshot)
class UserNutritionSnapshotAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_calories', 'created_at')
    readonly_fields = ('data', 'total_calories', 'created_at')
    list_filter = ('created_at', 'user')
    search_fields = ('user__username',)

@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ('user', 'name')
    search_fields = ('name', 'user__username')

@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('user', 'weekly_budget', 'spent')
    raw_id_fields = ('user',)
