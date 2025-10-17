from django.db import models
import uuid
# Create your models here.
# shopping/models.py

class Unit(models.TextChoices):
    EA = "ea", "Each"
    G = "g", "Gram"
    KG = "kg", "Kilogram"
    ML = "ml", "Milliliter"
    L = "l", "Liter"
    TSP = "tsp", "Teaspoon"
    TBSP = "tbsp", "Tablespoon"
    CUP = "cup", "Cup"
    OZ = "oz", "Ounce"
    LB = "lb", "Pound"

class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=160)
    retailer = models.CharField(max_length=40)  # "instacart" | "walmart" | "amazon" | "other"
    retailer_store_id = models.CharField(max_length=120, blank=True, null=True)
    fulfillment = models.CharField(max_length=20, blank=True, null=True)  # "delivery" | "pickup"
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Item(models.Model):
    class Bucket(models.TextChoices):
        LIST = "LIST", "List"
        CART = "CART", "Cart"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    amount_value = models.DecimalField(max_digits=12, decimal_places=3)  # normalized
    amount_unit = models.CharField(max_length=8, choices=Unit.choices)

    notes = models.TextField(blank=True)
    canonical_key = models.CharField(max_length=200, db_index=True)  # e.g., slug("eggs|ea")

    # save-for-later vs cart
    bucket = models.CharField(max_length=8, choices=Bucket.choices, default=Bucket.LIST)
    cart = models.ForeignKey(Cart, blank=True, null=True, on_delete=models.SET_NULL, related_name="items")

    # optional grouping/metadata
    section = models.CharField(max_length=40, blank=True, null=True)  # "produce" | "dairy" | ...
    tags = models.JSONField(default=list, blank=True)

    # provenance (array of objects)
    sources = models.JSONField(default=list, blank=True)  # [{recipeId, recipeName, servings, addedAt}]

    # optional store binding
    product = models.JSONField(blank=True, null=True)  # {retailer, externalSku, sizeDisplay, unitPrice, price, url, availability}

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
