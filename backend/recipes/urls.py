from django.urls import path
from . import views

urlpatterns = [
    path('recipes/', views.recipe_list, name='recipe_list'),
    path('recipes/popular/', views.recipe_popular, name='recipe_popular'),
    path('recipes/search/', views.recipe_search, name='recipe_search'),
    path('recipes/<int:recipe_id>/', views.recipe_detail, name='recipe_detail'),
    path('recipes/<int:recipe_id>/made/', views.recipe_made, name='recipe_made'),
    path('recipes/<int:recipe_id>/copy/', views.recipe_copy, name='recipe_copy'),
    path('recipes/trending/', views.trending_recipes_list, name='trending_recipes_list'),
    path('recipes/trending/weeks/', views.trending_recipes_weeks, name='trending_recipes_weeks'),
]
