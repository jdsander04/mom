from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

def get_default_storage():
    """Lazy import of default storage to avoid import-time evaluation"""
    from django.core.files.storage import default_storage
    return default_storage

# Create your models here.
class User(AbstractUser):
    # Explicitly use default storage to ensure MinIO is used when enabled
    # storage=None uses DEFAULT_FILE_STORAGE from settings
    profile_image = models.FileField(
        upload_to='profile-images/',
        blank=True,
        null=True,
        storage=None  # None means use DEFAULT_FILE_STORAGE from settings (S3Boto3Storage when MinIO enabled)
    )

    @property
    def profile_image_url(self):
        if self.profile_image:
            try:
                return self.profile_image.url
            except Exception:
                return None
        return None
