# Generated migration for adding recipe_names field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0005_orderhistory'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderhistory',
            name='recipe_names',
            field=models.JSONField(default=list),
        ),
    ]