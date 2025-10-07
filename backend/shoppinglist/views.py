from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from drf_spectacular.utils import extend_schema
from .models import ShoppingList, ShoppingListItem, Cart, CartItem


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string', 'description': 'Optional name for the list'},
				'items': {
					'type': 'array',
					'items': {
						'type': 'object',
						'properties': {
							'name': {'type': 'string'},
							'quantity': {'type': 'number'},
							'unit': {'type': 'string'},
						},
						'required': ['name']
					}
				}
			}
		}
	},
	responses={201: {'description': 'List generated'}},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def list_generate(request):
	# Create a list with provided items
	name = request.data.get('name', '')
	items = request.data.get('items', []) or []

	sl = ShoppingList.objects.create(user=request.user, name=name)
	for item in items:
		ShoppingListItem.objects.create(
			shopping_list=sl,
			name=item.get('name', ''),
			quantity=item.get('quantity') or 0,
			unit=item.get('unit') or ''
		)
	return Response({'list_id': sl.id}, status=201)


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'List items'}},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def list_items(request, list_id: int):
	try:
		sl = ShoppingList.objects.get(id=list_id, user=request.user)
	except ShoppingList.DoesNotExist:
		return Response({'error': 'List not found'}, status=404)

	items = [
		{
			'id': it.id,
			'name': it.name,
			'quantity': float(it.quantity),
			'unit': it.unit,
			'substituted': it.substituted,
		}
		for it in sl.items.all()
	]
	return Response({'list_id': sl.id, 'name': sl.name, 'items': items})


@extend_schema(
	methods=['DELETE', 'PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
				'quantity': {'type': 'number'},
				'unit': {'type': 'string'},
			}
		}
	},
	responses={200: {'description': 'Item updated or deleted'}},
)
@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def list_item_detail(request, list_id: int, item_id: int):
	try:
		sl = ShoppingList.objects.get(id=list_id, user=request.user)
	except ShoppingList.DoesNotExist:
		return Response({'error': 'List not found'}, status=404)

	try:
		item = sl.items.get(id=item_id)
	except ShoppingListItem.DoesNotExist:
		return Response({'error': 'Item not found'}, status=404)

	if request.method == 'DELETE':
		item.delete()
		return Response({'message': 'Item deleted'})

	# PATCH - substitute/modify ingredient
	data = request.data or {}
	updated = False
	if 'name' in data:
		item.name = data['name']; updated = True
	if 'quantity' in data and data['quantity'] is not None:
		item.quantity = data['quantity']; updated = True
	if 'unit' in data:
		item.unit = data['unit']; updated = True
	if updated:
		item.substituted = True
		item.save()
	return Response({'message': 'Item updated', 'item': {
		'id': item.id,
		'name': item.name,
		'quantity': float(item.quantity),
		'unit': item.unit,
		'substituted': item.substituted,
	}})


@extend_schema(
	methods=['DELETE'],
	responses={200: {'description': 'List deleted'}},
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def list_detail(request, list_id: int):
	try:
		sl = ShoppingList.objects.get(id=list_id, user=request.user)
	except ShoppingList.DoesNotExist:
		return Response({'error': 'List not found'}, status=404)
	sl.delete()
	return Response({'message': 'List deleted'})


@extend_schema(
	methods=['POST', 'GET', 'DELETE', 'PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
				'status': {'type': 'string'},
				'items': {
					'type': 'array',
					'items': {
						'type': 'object',
						'properties': {
							'name': {'type': 'string'},
							'quantity': {'type': 'number'},
							'unit': {'type': 'string'},
							'checked': {'type': 'boolean'},
						}
					}
				}
			}
		}
	},
	responses={200: {'description': 'Cart operation successful'}},
)
@api_view(['POST', 'GET', 'DELETE', 'PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_entry(request, identifier: int):
	"""
	Unified cart endpoint to satisfy routes:
	- POST /api/cart/:list_id -> create cart from list
	- GET /api/cart/:cart_id -> get cart information
	- DELETE /api/cart/:cart_id -> delete cart
	- PATCH /api/cart/:cart_id -> edit cart
	We infer semantic by HTTP method.
	"""
	if request.method == 'POST':
		# identifier is list_id
		try:
			sl = ShoppingList.objects.get(id=identifier, user=request.user)
		except ShoppingList.DoesNotExist:
			return Response({'error': 'List not found'}, status=404)
		cart = Cart.objects.create(user=request.user, shopping_list=sl, status='open')
		for it in sl.items.all():
			CartItem.objects.create(
				cart=cart,
				name=it.name,
				quantity=it.quantity,
				unit=it.unit,
				source_list_item=it,
			)
		return Response({'cart_id': cart.id}, status=201)

	# For other methods, identifier is cart_id
	try:
		cart = Cart.objects.get(id=identifier, user=request.user)
	except Cart.DoesNotExist:
		return Response({'error': 'Cart not found'}, status=404)

	if request.method == 'GET':
		items = [
			{
				'id': ci.id,
				'name': ci.name,
				'quantity': float(ci.quantity),
				'unit': ci.unit,
				'checked': ci.checked,
			}
			for ci in cart.items.all()
		]
		return Response({'cart_id': cart.id, 'status': cart.status, 'items': items})

	if request.method == 'DELETE':
		cart.delete()
		return Response({'message': 'Cart deleted'})

	# PATCH - edit cart name/status/items
	data = request.data or {}
	if 'status' in data:
		cart.status = data['status']
	cart.save()

	items = data.get('items')
	if isinstance(items, list):
		for patch in items:
			item_id = patch.get('id')
			if not item_id:
				# create new
				CartItem.objects.create(
					cart=cart,
					name=patch.get('name', ''),
					quantity=patch.get('quantity') or 0,
					unit=patch.get('unit') or '',
					checked=bool(patch.get('checked')),
				)
				continue
			try:
				ci = cart.items.get(id=item_id)
			except CartItem.DoesNotExist:
				continue
			if patch.get('delete'):
				ci.delete();
				continue
			if 'name' in patch:
				ci.name = patch['name']
			if 'quantity' in patch and patch['quantity'] is not None:
				ci.quantity = patch['quantity']
			if 'unit' in patch:
				ci.unit = patch['unit']
			if 'checked' in patch:
				ci.checked = bool(patch['checked'])
			ci.save()

	return Response({'message': 'Cart updated'})

