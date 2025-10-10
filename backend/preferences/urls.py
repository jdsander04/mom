from django.urls import path
from . import views

urlpatterns = [
    path('preferences/', views.preferences_view, name='preferences'),
    path('preferences/diet_suggestions/', views.diet_suggestions, name='diet_suggestions'),
    path('preferences/ingredient_suggestions/', views.ingredient_suggestions, name='ingredient_suggestions'),
    # CRUD for diets
    path('preferences/diets/', views.add_diet, name='add_diet'),
    path('preferences/diets/<str:item_id>/', views.update_diet, name='update_diet'),
    path('preferences/diets/<str:item_id>/delete/', views.delete_diet, name='delete_diet'),
    # CRUD for allergens
    path('preferences/allergens/', views.add_allergen, name='add_allergen'),
    path('preferences/allergens/<str:item_id>/', views.update_allergen, name='update_allergen'),
    path('preferences/allergens/<str:item_id>/delete/', views.delete_allergen, name='delete_allergen'),
]
