from django.urls import path
from . import views

urlpatterns = [
    path('preferences/', views.preferences_view, name='preferences'),
    path('preferences/diet_suggestions/', views.diet_suggestions, name='diet_suggestions'),
    path('preferences/ingredient_suggestions/', views.ingredient_suggestions, name='ingredient_suggestions'),
]
