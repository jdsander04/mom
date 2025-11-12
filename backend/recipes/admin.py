from django.contrib import admin
from .models import Recipe, Ingredient, Step, Nutrient, TrendingRecipe

admin.site.register(Recipe)
admin.site.register(Ingredient)
admin.site.register(Step)
admin.site.register(Nutrient)

@admin.register(TrendingRecipe)
class TrendingRecipeAdmin(admin.ModelAdmin):
    list_display = ('title', 'week', 'position', 'spoonacular_id', 'week_start_date', 'created_at')
    list_filter = ('week', 'created_at')
    search_fields = ('title', 'week', 'spoonacular_id')
    ordering = ('-week', 'position')
    readonly_fields = ('created_at',)
    
    fieldsets = (
        ('Week Information', {
            'fields': ('week', 'position', 'week_start_date')
        }),
        ('Recipe Information', {
            'fields': ('spoonacular_id', 'title', 'description', 'image_url', 'source_url')
        }),
        ('Recipe Details', {
            'fields': ('ready_in_minutes', 'servings', 'recipe_data')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )
