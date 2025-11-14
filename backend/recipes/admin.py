from django.contrib import admin
from .models import Recipe, Ingredient, Step, Nutrient, TrendingRecipe

admin.site.register(Recipe)
admin.site.register(Ingredient)
admin.site.register(Step)
admin.site.register(Nutrient)

@admin.register(TrendingRecipe)
class TrendingRecipeAdmin(admin.ModelAdmin):
    list_display = ('get_recipe_name', 'week', 'position', 'spoonacular_id', 'week_start_date', 'created_at')
    list_filter = ('week', 'created_at')
    search_fields = ('recipe__name', 'week', 'spoonacular_id')
    ordering = ('-week', 'position')
    readonly_fields = ('created_at',)
    raw_id_fields = ('recipe',)
    
    fieldsets = (
        ('Week Information', {
            'fields': ('week', 'position', 'week_start_date')
        }),
        ('Recipe Link', {
            'fields': ('recipe', 'spoonacular_id')
        }),
        ('Trending Metadata', {
            'fields': ('ready_in_minutes', 'recipe_data')
        }),
        ('Metadata', {
            'fields': ('created_at',)
        }),
    )
    
    def get_recipe_name(self, obj):
        """Display the recipe name in the admin list."""
        return obj.recipe.name if obj.recipe else 'No Recipe'
    get_recipe_name.short_description = 'Recipe Name'
