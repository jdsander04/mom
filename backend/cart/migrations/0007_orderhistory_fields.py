# Generated migration for new OrderHistory fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cart', '0006_orderhistory_recipe_names'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderhistory',
            name='top_recipe_image',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='orderhistory',
            name='nutrition_data',
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name='orderhistory',
            name='total_price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]