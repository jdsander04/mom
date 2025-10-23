# Generated migration to fix description field length

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recipes', '0008_alter_ingredient_name_alter_ingredient_unit_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='recipe',
            name='description',
            field=models.TextField(),
        ),
    ]