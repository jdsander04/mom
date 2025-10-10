from django.contrib import admin
from .models import Preference


@admin.register(Preference)
class PreferenceAdmin(admin.ModelAdmin):
	list_display = ('user', 'updated_at')
