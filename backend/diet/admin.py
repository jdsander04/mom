from django.contrib import admin, messages
from .models import DietSuggestion, IngredientSuggestion

@admin.register(DietSuggestion)
class DietSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'created_at')
    search_fields = ('name', 'description')
    ordering = ('name',)
    actions = ['add_default_presets']

    def add_default_presets(self, request, queryset):
        presets = [
            {'name': 'Vegan', 'description': 'No animal products'},
            {'name': 'Vegetarian', 'description': 'No meat'},
            {'name': 'Pescatarian', 'description': 'Includes fish but no other meat'},
            {'name': 'Gluten-Free', 'description': 'Avoids gluten-containing grains'},
            {'name': 'Keto', 'description': 'Low-carb, high-fat'},
            {'name': 'Paleo', 'description': 'Whole foods, no processed foods'},
            {'name': 'Low-FODMAP', 'description': 'For certain digestive sensitivities'},
            {'name': 'Halal', 'description': 'Permitted by Islamic law'},
            {'name': 'Kosher', 'description': 'Prepared according to Jewish dietary law'},
            {'name': 'Low-Sugar', 'description': 'Reduced sugar intake'},
        ]
        created = 0
        for item in presets:
            obj, was_created = DietSuggestion.objects.get_or_create(
                name=item['name'],
                defaults={'description': item.get('description', '')}
            )
            if was_created:
                created += 1
        if created:
            messages.success(request, f"Added {created} diet suggestion(s).")
        else:
            messages.info(request, "No new diet suggestions were added (all presets already exist).")
    add_default_presets.short_description = "Add default diet suggestions (seed presets)"


@admin.register(IngredientSuggestion)
class IngredientSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'created_at')
    search_fields = ('name', 'description')
    ordering = ('name',)
    actions = ['add_default_presets']

    def add_default_presets(self, request, queryset):
        presets = [
            {'name': 'Vanilla', 'description': ''},
            {'name': 'Sugar', 'description': ''},
            {'name': 'Salt', 'description': ''},
            {'name': 'Butter', 'description': ''},
            {'name': 'Olive Oil', 'description': ''},
            {'name': 'Garlic', 'description': ''},
            {'name': 'Onion', 'description': ''},
            {'name': 'Tomato', 'description': ''},
            {'name': 'Chicken Breast', 'description': ''},
            {'name': 'Lemon', 'description': ''},
        ]
        created = 0
        for item in presets:
            obj, was_created = IngredientSuggestion.objects.get_or_create(
                name=item['name'],
                defaults={'description': item.get('description', '')}
            )
            if was_created:
                created += 1
        if created:
            messages.success(request, f"Added {created} ingredient suggestion(s).")
        else:
            messages.info(request, "No new ingredient suggestions were added (all presets already exist).")
    add_default_presets.short_description = "Add default ingredient suggestions (seed presets)"
