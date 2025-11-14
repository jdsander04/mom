# Generated migration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0015_trendingrecipe'),
    ]

    operations = [
        migrations.AddField(
            model_name='ingredient',
            name='original_text',
            field=models.TextField(blank=True, default=''),
        ),
    ]
