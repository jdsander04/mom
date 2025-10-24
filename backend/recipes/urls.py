from django.urls import path
from . import views

urlpatterns = [
    path('recipes/', views.recipe_list, name='recipe_list'),
    path('recipes/search/', views.recipe_search, name='recipe_search'),
    path('recipes/<int:recipe_id>/', views.recipe_detail, name='recipe_detail'),
    path('recipes/<int:recipe_id>/made/', views.recipe_made, name='recipe_made'),
]
