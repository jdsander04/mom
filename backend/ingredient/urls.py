from django.urls import path
from . import views

urlpatterns = [
    path('ingredients/', views.ingredient_list, name='ingredient_list'),
    path('ingredients/<uuid:ingredient_id>/', views.ingredient_detail, name='ingredient_detail'),
]
