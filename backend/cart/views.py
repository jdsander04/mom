from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from drf_spectacular.utils import extend_schema

from shoppinglist.models import ShoppingList, Cart, CartItem


@extend_schema(
	methods=['POST', 'GET', 'DELETE', 'PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'status': {'type': 'string'},
				'items': {
					'type': 'array',
					'items': {
						'type': 'object',
						'properties': {
							'id': {'type': 'integer'},
							'name': {'type': 'string'},
							'quantity': {'type': 'number'},
							'unit': {'type': 'string'},
							'checked': {'type': 'boolean'},
							'delete': {'type': 'boolean'},
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
	Unified cart endpoint compatible with legacy route semantics:
	- POST /api/cart/:list_id -> create cart from list
	- GET /api/cart/:cart_id -> get cart information
	- DELETE /api/cart/:cart_id -> delete cart
	- PATCH /api/cart/:cart_id -> edit cart
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

	# PATCH - edit cart status/items (bulk)
	data = request.data or {}
	if 'status' in data:
		cart.status = data['status']
		cart.save(update_fields=['status'])

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
				ci.delete()
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

@extend_schema(
	methods=['GET'],
	operation_id='cart_list',
	parameters=[],
	responses={200: {'description': 'List carts for the user'}},
)
@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'shopping_list_id': {'type': 'integer', 'description': 'Optional list id to seed the cart from'},
				'status': {'type': 'string'},
			}
		}
	},
	responses={201: {'description': 'Cart created'}},
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_list(request):
	if request.method == 'GET':
		status_filter = request.query_params.get('status')
		qs = Cart.objects.filter(user=request.user).order_by('-updated_at')
		if status_filter:
			qs = qs.filter(status=status_filter)
		data = [
			{
				'id': c.id,
				'status': c.status,
				'created_at': c.created_at.isoformat(),
				'updated_at': c.updated_at.isoformat(),
				'list_id': c.shopping_list_id,
				'item_count': c.items.count(),
			}
			for c in qs
		]
		return Response({'carts': data})

	# POST -> create cart (optionally from list)
	payload = request.data or {}
	status_val = payload.get('status') or 'open'
	list_id = payload.get('shopping_list_id')
	cart = None
	if list_id:
		try:
			sl = ShoppingList.objects.get(id=list_id, user=request.user)
		except ShoppingList.DoesNotExist:
			return Response({'error': 'List not found'}, status=404)
		cart = Cart.objects.create(user=request.user, shopping_list=sl, status=status_val)
		for it in sl.items.all():
			CartItem.objects.create(
				cart=cart,
				name=it.name,
				quantity=it.quantity,
				unit=it.unit,
				source_list_item=it,
			)
	else:
		cart = Cart.objects.create(user=request.user, status=status_val)

	resp = Response({'cart_id': cart.id}, status=201)
	# Optional Location header
	try:
		from django.urls import reverse
		resp['Location'] = request.build_absolute_uri(reverse('cart_detail', args=[cart.id]))
	except Exception:
		pass
	return resp


@extend_schema(
	methods=['POST'],
	responses={201: {'description': 'Cart created from list'}},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_create_from_list(request, list_id: int):
	try:
		sl = ShoppingList.objects.get(id=list_id, user=request.user)
	except ShoppingList.DoesNotExist:
		return Response({'error': 'List not found'}, status=404)
	cart = Cart.objects.create(user=request.user, shopping_list=sl, status='open')
	# Copy items
	for it in sl.items.all():
		CartItem.objects.create(
			cart=cart,
			name=it.name,
			quantity=it.quantity,
			unit=it.unit,
			source_list_item=it,
		)
	resp = Response({'cart_id': cart.id}, status=201)
	try:
		from django.urls import reverse
		resp['Location'] = request.build_absolute_uri(reverse('cart_detail', args=[cart.id]))
	except Exception:
		pass
	return resp


@extend_schema(
	methods=['GET'],
	operation_id='cart_detail',
	responses={200: {'description': 'Cart details'}},
)
@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'status': {'type': 'string'},
			}
		}
	},
	responses={200: {'description': 'Cart updated'}},
)
@extend_schema(
	methods=['DELETE'],
	responses={204: {'description': 'Cart deleted'}},
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_detail(request, cart_id: int):
	try:
		cart = Cart.objects.get(id=cart_id, user=request.user)
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
		return Response({
			'cart_id': cart.id,
			'status': cart.status,
			'items': items,
		})

	if request.method == 'PATCH':
		data = request.data or {}
		if 'status' in data:
			cart.status = data['status']
		cart.save()
		return Response({'message': 'Cart updated'})

	cart.delete()
	return Response(status=204)


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
				'quantity': {'type': 'number'},
				'unit': {'type': 'string'},
				'checked': {'type': 'boolean'},
			},
			'required': ['name']
		}
	},
	responses={201: {'description': 'Cart item created'}},
)
@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'items': {
					'type': 'array',
					'items': {
						'type': 'object',
						'properties': {
							'id': {'type': 'integer'},
							'name': {'type': 'string'},
							'quantity': {'type': 'number'},
							'unit': {'type': 'string'},
							'checked': {'type': 'boolean'},
							'delete': {'type': 'boolean'},
						}
					}
				}
			},
			'required': ['items']
		}
	},
	responses={200: {'description': 'Cart updated'}},
)
@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_items_collection(request, cart_id: int):
	try:
		cart = Cart.objects.get(id=cart_id, user=request.user)
	except Cart.DoesNotExist:
		return Response({'error': 'Cart not found'}, status=404)

	if request.method == 'POST':
		data = request.data or {}
		name = data.get('name')
		if not name:
			return Response({'error': 'name is required'}, status=400)
		ci = CartItem.objects.create(
			cart=cart,
			name=name,
			quantity=data.get('quantity') or 0,
			unit=data.get('unit') or '',
			checked=bool(data.get('checked')),
		)
		return Response({
			'id': ci.id,
			'name': ci.name,
			'quantity': float(ci.quantity),
			'unit': ci.unit,
			'checked': ci.checked,
		}, status=201)

	# PATCH bulk
	payload = request.data or {}
	patches = payload.get('items')
	if not isinstance(patches, list):
		return Response({'error': 'items must be a list'}, status=400)
	for patch in patches:
		item_id = patch.get('id')
		if not item_id:
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


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'List items in the cart'}},
)
@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
				'quantity': {'type': 'number'},
				'unit': {'type': 'string'},
				'checked': {'type': 'boolean'},
			},
			'required': ['name']
		}
	},
	responses={201: {'description': 'Cart item created'}},
)
@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'items': {
					'type': 'array',
					'items': {
						'type': 'object',
						'properties': {
							'id': {'type': 'integer'},
							'name': {'type': 'string'},
							'quantity': {'type': 'number'},
							'unit': {'type': 'string'},
							'checked': {'type': 'boolean'},
							'delete': {'type': 'boolean'},
						}
					}
				}
			},
			'required': ['items']
		}
	},
	responses={200: {'description': 'Cart updated'}},
)
@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_items_collection(request, cart_id: int):
	try:
		cart = Cart.objects.get(id=cart_id, user=request.user)
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
		return Response({'items': items})

	if request.method == 'POST':
		data = request.data or {}
		name = data.get('name')
		if not name:
			return Response({'error': 'name is required'}, status=400)
		ci = CartItem.objects.create(
			cart=cart,
			name=name,
			quantity=data.get('quantity') or 0,
			unit=data.get('unit') or '',
			checked=bool(data.get('checked')),
		)
		resp = Response({
			'id': ci.id,
			'name': ci.name,
			'quantity': float(ci.quantity),
			'unit': ci.unit,
			'checked': ci.checked,
		}, status=201)
		try:
			from django.urls import reverse
			resp['Location'] = request.build_absolute_uri(reverse('cart_item_update_delete', args=[cart.id, ci.id]))
		except Exception:
			pass
		return resp


@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
				'quantity': {'type': 'number'},
				'unit': {'type': 'string'},
				'checked': {'type': 'boolean'},
			}
		}
	},
	responses={200: {'description': 'Cart item updated'}},
)
@extend_schema(
	methods=['DELETE'],
	responses={200: {'description': 'Cart item deleted'}},
)
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_item_update_delete(request, cart_id: int, item_id: int):
	try:
		cart = Cart.objects.get(id=cart_id, user=request.user)
	except Cart.DoesNotExist:
		return Response({'error': 'Cart not found'}, status=404)
	try:
		ci = cart.items.get(id=item_id)
	except CartItem.DoesNotExist:
		return Response({'error': 'Item not found'}, status=404)

	if request.method == 'DELETE':
		ci.delete()
		return Response(status=204)

	data = request.data or {}
	if 'name' in data:
		ci.name = data['name']
	if 'quantity' in data and data['quantity'] is not None:
		ci.quantity = data['quantity']
	if 'unit' in data:
		ci.unit = data['unit']
	if 'checked' in data:
		ci.checked = bool(data['checked'])
	ci.save()
	return Response({'message': 'Cart item updated', 'item': {
		'id': ci.id,
		'name': ci.name,
		'quantity': float(ci.quantity),
		'unit': ci.unit,
		'checked': ci.checked,
	}})


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'ids': {
					'type': 'array',
					'items': {'type': 'integer'}
				},
				'checked': {'type': 'boolean'},
			},
			'required': ['ids', 'checked']
		}
	},
	responses={200: {'description': 'Bulk checked state updated'}},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def cart_items_check(request, cart_id: int):
	try:
		cart = Cart.objects.get(id=cart_id, user=request.user)
	except Cart.DoesNotExist:
		return Response({'error': 'Cart not found'}, status=404)
	data = request.data or {}
	ids = data.get('ids') or []
	checked = bool(data.get('checked'))
	updated = 0
	if isinstance(ids, list) and ids:
		for item_id in ids:
			try:
				ci = cart.items.get(id=item_id)
			except CartItem.DoesNotExist:
				continue
			ci.checked = checked
			ci.save(update_fields=['checked'])
			updated += 1
	return Response({'updated': updated})

