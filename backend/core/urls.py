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
from django.urls import path, include, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from . import views

urlpatterns = [
    # Admin path
    path('admin/', admin.site.urls),
    
    # Media proxy - must be before other paths to catch /media/ requests
    re_path(r'^media/(?P<path>.*)$', views.media_proxy, name='media_proxy'),
    
    # Auth paths
    path('api/auth/signup/', views.signup, name='signup'),
    path('api/auth/login/', views.login, name='login'),
    path('api/auth/logout/', views.logout, name='logout'),
    path('api/auth/account/', views.delete_account, name='delete_account'),

    # Media upload endpoint
    path('api/media/upload/', views.media_upload, name='media_upload'),

    # Standard path
    path('api/', include('cart.urls')),
    path('api/', include('recipes.urls')),
    path('api/', include('meal_calendar.urls')),
    path('api/', include('preferences.urls')),
    path('api/', include('diet.urls')),
    path('api/', include('users.urls')),
    path('api/health/', include('health.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]
