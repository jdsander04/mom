from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Preference

DIET_DB = ['Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low Carb', 'Mediterranean', 'Gluten Free']
INGREDIENT_DB = ['Peanut', 'Milk', 'Egg', 'Soy', 'Wheat', 'Shellfish', 'Tree Nut', 'Sesame']


def _query_list(db, q: str, limit: int = 6):
	s = (q or '').strip().lower()
	if not s:
		return db[:limit]
	return [x for x in db if s in x.lower()][:limit]


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'User preferences'}}
)
@extend_schema(
	methods=['PUT'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'diets': {'type': 'array', 'items': {'type': 'string'}},
				'allergens': {'type': 'array', 'items': {'type': 'string'}}
			}
		}
	},
	responses={200: {'description': 'Preferences updated'}}
)
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def preferences_view(request):
	# Ensure preferences object exists
	pref, _ = Preference.objects.get_or_create(user=request.user)

	if request.method == 'GET':
		return Response({'diets': pref.diets, 'allergens': pref.allergens})

	# PUT: replace lists
	data = request.data
	diets = data.get('diets', [])
	allergens = data.get('allergens', [])
	pref.diets = diets
	pref.allergens = allergens
	pref.save()
	return Response({'diets': pref.diets, 'allergens': pref.allergens})


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'Diet suggestions'}}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def diet_suggestions(request):
	q = request.query_params.get('q', '')
	return Response({'suggestions': _query_list(DIET_DB, q)})


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'Ingredient suggestions'}}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def ingredient_suggestions(request):
	q = request.query_params.get('q', '')
	return Response({'suggestions': _query_list(INGREDIENT_DB, q)})


# CRUD endpoints for diets and allergens using small item objects { id, value }
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def add_diet(request):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	item = request.data
	# Accept either {id, value} or just {'value': '...'}
	value = item.get('value') or item.get('v') or (item if isinstance(item, str) else None)
	if not value:
		return Response({'error': 'Missing value'}, status=400)
	new_id = item.get('id') or str(__import__('time').time())
	pref.diets.append({'id': new_id, 'value': value} if isinstance(pref.diets, list) and pref.diets and isinstance(pref.diets[0], dict) else value)
	pref.save()
	return Response({'diets': pref.diets})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def update_diet(request, item_id):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	for i, it in enumerate(pref.diets):
		if (isinstance(it, dict) and it.get('id') == item_id) or (not isinstance(it, dict) and str(i) == item_id):
			new_value = request.data.get('value')
			if new_value is None:
				return Response({'error': 'Missing value'}, status=400)
			if isinstance(it, dict):
				it['value'] = new_value
				pref.diets[i] = it
			else:
				pref.diets[i] = new_value
			pref.save()
			return Response({'diets': pref.diets})
	return Response({'error': 'Item not found'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def delete_diet(request, item_id):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	new_list = []
	found = False
	for i, it in enumerate(pref.diets):
		if (isinstance(it, dict) and it.get('id') == item_id) or (not isinstance(it, dict) and str(i) == item_id):
			found = True
			continue
		new_list.append(it)
	if not found:
		return Response({'error': 'Item not found'}, status=404)
	pref.diets = new_list
	pref.save()
	return Response({'diets': pref.diets})


# Allergens CRUD
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def add_allergen(request):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	item = request.data
	value = item.get('value') or item.get('v') or (item if isinstance(item, str) else None)
	if not value:
		return Response({'error': 'Missing value'}, status=400)
	new_id = item.get('id') or str(__import__('time').time())
	pref.allergens.append({'id': new_id, 'value': value} if isinstance(pref.allergens, list) and pref.allergens and isinstance(pref.allergens[0], dict) else value)
	pref.save()
	return Response({'allergens': pref.allergens})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def update_allergen(request, item_id):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	for i, it in enumerate(pref.allergens):
		if (isinstance(it, dict) and it.get('id') == item_id) or (not isinstance(it, dict) and str(i) == item_id):
			new_value = request.data.get('value')
			if new_value is None:
				return Response({'error': 'Missing value'}, status=400)
			if isinstance(it, dict):
				it['value'] = new_value
				pref.allergens[i] = it
			else:
				pref.allergens[i] = new_value
			pref.save()
			return Response({'allergens': pref.allergens})
	return Response({'error': 'Item not found'}, status=404)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def delete_allergen(request, item_id):
	pref, _ = Preference.objects.get_or_create(user=request.user)
	new_list = []
	found = False
	for i, it in enumerate(pref.allergens):
		if (isinstance(it, dict) and it.get('id') == item_id) or (not isinstance(it, dict) and str(i) == item_id):
			found = True
			continue
		new_list.append(it)
	if not found:
		return Response({'error': 'Item not found'}, status=404)
	pref.allergens = new_list
	pref.save()
	return Response({'allergens': pref.allergens})
