from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("recipes", "0013_recipe_favorite"),
    ]

    operations = [
        migrations.AddField(
            model_name="recipe",
            name="serves",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]


