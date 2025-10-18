# Generated migration to fix field lengths

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0006_recipe_image_url'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ingredient',
            name='name',
            field=models.CharField(max_length=500),
        ),
        migrations.AlterField(
            model_name='ingredient',
            name='unit',
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name='nutrient',
            name='macro',
            field=models.CharField(max_length=100),
        ),
    ]