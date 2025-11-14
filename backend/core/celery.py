import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('mom')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Configure periodic tasks (Celery Beat schedule)
# Note: With django-celery-beat, you can also manage schedules via Django admin
# This is a fallback schedule that will be used if not configured in admin
app.conf.beat_schedule = {
    'fetch-weekly-trending-recipes': {
        'task': 'recipes.tasks.fetch_weekly_trending_recipes',
        'schedule': crontab(hour=23, minute=0, day_of_week=5),  # Friday at 11:00 PM
    },
}

