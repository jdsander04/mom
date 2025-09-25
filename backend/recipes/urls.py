from django.urls import path
from . import views

urlpatterns = [
    path('recipes/', views.recipe_list, name='recipe_list'),
    path('recipes/create/', views.recipe_create, name='recipe_create'),
    path('recipes/delete/<int:recipe_id>/', views.recipe_delete, name='recipe_delete'),
]
