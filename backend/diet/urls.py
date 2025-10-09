from django.urls import path
from . import views

urlpatterns = [
    path('diet/pref', views.pref_list_create, name='pref_list_create'),
    path('diet/pref/<int:pref_id>/', views.pref_delete, name='pref_delete'),

    path('diet-rest', views.rest_list_create, name='rest_list_create'),
    path('diet-rest/<int:rest_id>/', views.rest_delete, name='rest_delete'),
]
