from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Item, Cart
from .serializers import ItemSerializer, CartSerializer


class ItemViewSet(viewsets.ModelViewSet):
	"""Basic ModelViewSet for Item with two custom actions:
	- move_to_cart: move this item into a Cart (create or use existing). Merges with same canonical_key.
	- move_to_list: move this item back to the LIST bucket and optionally merge with existing list item.
	"""

	queryset = Item.objects.all()
	serializer_class = ItemSerializer

	@action(detail=True, methods=("post",))
	@transaction.atomic
	def move_to_cart(self, request, pk=None):
		item = get_object_or_404(Item, pk=pk)
		data = request.data or {}
		cart_id = data.get("cart_id")
		create_cart = data.get("create_cart")
		merge = data.get("merge", True)

		# determine target cart
		if cart_id:
			cart = get_object_or_404(Cart, pk=cart_id)
		elif create_cart:
			cart_serializer = CartSerializer(data=create_cart)
			cart_serializer.is_valid(raise_exception=True)
			cart = cart_serializer.save()
		else:
			return Response({"detail": "cart_id or create_cart required"}, status=status.HTTP_400_BAD_REQUEST)

		# find existing item in this cart with same canonical_key
		existing = None
		if merge and item.canonical_key:
			existing = (
				Item.objects.filter(canonical_key=item.canonical_key, bucket=Item.Bucket.CART, cart=cart)
				.exclude(pk=item.pk)
				.first()
			)

		if existing:
			existing.amount_value = Decimal(existing.amount_value) + Decimal(item.amount_value)
			existing.save(update_fields=["amount_value", "updated_at"])
			item.delete()
			return Response(ItemSerializer(existing).data, status=status.HTTP_200_OK)
		else:
			item.bucket = Item.Bucket.CART
			item.cart = cart
			item.save(update_fields=["bucket", "cart", "updated_at"])
			return Response(ItemSerializer(item).data, status=status.HTTP_200_OK)

	@action(detail=True, methods=("post",))
	@transaction.atomic
	def move_to_list(self, request, pk=None):
		item = get_object_or_404(Item, pk=pk)
		merge = request.data.get("merge", True)

		existing = None
		if merge and item.canonical_key:
			existing = (
				Item.objects.filter(canonical_key=item.canonical_key, bucket=Item.Bucket.LIST)
				.exclude(pk=item.pk)
				.first()
			)

		if existing:
			existing.amount_value = Decimal(existing.amount_value) + Decimal(item.amount_value)
			existing.save(update_fields=["amount_value", "updated_at"])
			item.delete()
			return Response(ItemSerializer(existing).data, status=status.HTTP_200_OK)
		else:
			item.bucket = Item.Bucket.LIST
			item.cart = None
			item.save(update_fields=["bucket", "cart", "updated_at"])
			return Response(ItemSerializer(item).data, status=status.HTTP_200_OK)

