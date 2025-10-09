from django.urls import path
from . import views

urlpatterns = [
    path('calendar/<int:userid>/', views.meal_plan_list, name='meal_plan_list'),
    path('calendar/<int:userid>/<str:date>/', views.meal_plan_detail, name='meal_plan_detail'),
]