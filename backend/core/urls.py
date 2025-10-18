"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from . import views

urlpatterns = [
    # Admin path
    path('admin/', admin.site.urls),
    
    # Auth paths
    path('api/auth/signup/', views.signup, name='signup'),
    path('api/auth/login/', views.login, name='login'),
    path('api/auth/logout/', views.logout, name='logout'),
    path('api/auth/account/', views.delete_account, name='delete_account'),

    # Standard path
    path('api/', include('cart.urls')),
    path('api/', include('recipes.urls')),

    path('api/', include('meal_calendar.urls')),
    path('api/', include('preferences.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
