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
