from django.urls import path, re_path
from . import views

urlpatterns = [
    # List endpoints (accept with or without trailing slash)
    re_path(r'^list/?$', views.list_generate, name='list_generate'),  # POST /api/list
    re_path(r'^list/(?P<list_id>\d+)/item/?$', views.list_items, name='list_items'),  # GET /api/list/:list_id/item
    re_path(r'^list/(?P<list_id>\d+)/item/(?P<item_id>\d+)/?$', views.list_item_detail, name='list_item_detail'),  # DELETE/PATCH
    re_path(r'^list/(?P<list_id>\d+)/?$', views.list_detail, name='list_detail'),  # DELETE /api/list/:list_id

    # Cart endpoints (single entry point to avoid path conflicts)
    re_path(r'^cart/(?P<identifier>\d+)/?$', views.cart_entry, name='cart_entry'),
]
