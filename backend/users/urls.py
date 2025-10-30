from django.urls import path
from .views import ProfileImageView, ProfileImageFileView

urlpatterns = [
    path('users/me/profile-image/', ProfileImageView.as_view(), name='profile-image'),
    path('users/me/profile-image/file/', ProfileImageFileView.as_view(), name='profile-image-file'),
]


