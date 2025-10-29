from django.urls import path
from .views import ProfileImageView

urlpatterns = [
    path('users/me/profile-image/', ProfileImageView.as_view(), name='profile-image'),
]


