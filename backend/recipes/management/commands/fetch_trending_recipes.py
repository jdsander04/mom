"""
Management command to manually fetch trending recipes from Spoonacular.
Usage: python manage.py fetch_trending_recipes
"""
from django.core.management.base import BaseCommand
from recipes.tasks import fetch_weekly_trending_recipes


class Command(BaseCommand):
    help = 'Manually fetch trending recipes from Spoonacular API'

    def handle(self, *args, **options):
        self.stdout.write('Fetching trending recipes from Spoonacular...')
        
        # Call the task directly (synchronously)
        result = fetch_weekly_trending_recipes()
        
        if result.get('status') == 'success':
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully fetched {result.get('count', 0)} recipes for week {result.get('week', 'unknown')}"
                )
            )
        elif result.get('status') == 'skipped':
            self.stdout.write(
                self.style.WARNING(
                    f"Skipped: {result.get('message', 'Recipes already exist for this week')}"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"Error: {result.get('message', 'Unknown error occurred')}"
                )
            )

