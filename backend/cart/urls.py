from django.urls import path
from . import views

urlpatterns = [
    path('cart/', views.cart_detail, name='cart_detail'),
    path('cart/items/', views.cart_items, name='cart_items'),
    path('cart/recipes/', views.add_recipe_to_cart, name='cart_recipes'),
]
