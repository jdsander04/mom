from django.urls import path
from . import views

urlpatterns = [
    # Carts collection
    path('carts/', views.cart_list, name='cart_list'),                    # GET (list), POST (create)
    path('carts/from-list/<int:list_id>/', views.cart_create_from_list, name='cart_create_from_list'),  # optional helper

    # Single cart
    path('carts/<int:cart_id>/', views.cart_detail, name='cart_detail'),  # GET, PATCH, DELETE

    # Cart items (collection and single)
    path('carts/<int:cart_id>/items/', views.cart_items_collection, name='cart_items_collection'),  # POST (add one), PATCH (bulk)
    path('carts/<int:cart_id>/items/<int:item_id>/', views.cart_item_update_delete, name='cart_item_update_delete'),  # PATCH, DELETE

    # Bulk check/uncheck (kept as convenience)
    path('carts/<int:cart_id>/items/check/', views.cart_items_check, name='cart_items_check'),  # POST
]
