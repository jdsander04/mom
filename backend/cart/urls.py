from django.urls import path
from . import views

urlpatterns = [
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/items/', views.cart_items, name='cart_items'),
    path('cart/recipes/', views.add_recipe_to_cart, name='cart_recipes'),
    path('cart/meal-plans/', views.add_meal_plans_to_cart, name='add_meal_plans_to_cart'),
    path('cart/week/', views.add_week_to_cart, name='add_week_to_cart'),
    path('cart/instacart/', views.create_instacart_list, name='create_instacart_list'),
]
