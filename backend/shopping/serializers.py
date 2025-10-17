from decimal import Decimal
from rest_framework import serializers

from .models import Item, Cart


class CartSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cart
        fields = (
            "id",
            "label",
            "retailer",
            "retailer_store_id",
            "fulfillment",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = (
            "id",
            "title",
            "amount_value",
            "amount_unit",
            "notes",
            "canonical_key",
            "bucket",
            "cart",
            "section",
            "tags",
            "sources",
            "product",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
