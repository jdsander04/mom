from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.
class User(AbstractUser):
    profile_image = models.FileField(upload_to='profile-images/', blank=True, null=True)

    @property
    def profile_image_url(self):
        if self.profile_image:
            try:
                return self.profile_image.url
            except Exception:
                return None
        return None
