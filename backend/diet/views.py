from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging
from django.db import OperationalError
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from .models import DietaryPreference, DietaryRestriction, DietSuggestion, IngredientSuggestion

logger = logging.getLogger(__name__)


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'List of dietary preferences'}}
)
@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'name': {'type': 'string'},
			},
			'required': ['name']
		}
	},
	responses={201: {'description': 'Preference created'}}
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def pref_list_create(request):
	"""GET list of user's preferences, POST to create one."""
	if request.method == 'GET':
		prefs = DietaryPreference.objects.filter(user=request.user)
		data = [{'id': p.id, 'name': p.name} for p in prefs]
		return Response({'preferences': data})

	# POST
	name = request.data.get('name')
	if not name:
		return Response({'error': 'Missing "name"'}, status=400)

	pref = DietaryPreference.objects.create(user=request.user, name=name)
	return Response({'id': pref.id, 'name': pref.name}, status=201)


@extend_schema(
	methods=['DELETE'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {'pref_id': {'type': 'integer'}},
			'required': ['pref_id']
		}
	},
	responses={200: {'description': 'Preference deleted'}}
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def pref_delete(request, pref_id: int):
	try:
		pref = DietaryPreference.objects.get(id=pref_id, user=request.user)
	except DietaryPreference.DoesNotExist:
		return Response({'error': 'Preference not found'}, status=404)

	pref.delete()
	return Response({'message': f'Preference {pref_id} deleted'})


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'List of dietary restrictions'}}
)
@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {'name': {'type': 'string'}},
			'required': ['name']
		}
	},
	responses={201: {'description': 'Restriction created'}}
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def rest_list_create(request):
	if request.method == 'GET':
		rests = DietaryRestriction.objects.filter(user=request.user)
		data = [{'id': r.id, 'name': r.name} for r in rests]
		return Response({'restrictions': data})

	name = request.data.get('name')
	if not name:
		return Response({'error': 'Missing "name"'}, status=400)

	rest = DietaryRestriction.objects.create(user=request.user, name=name)
	return Response({'id': rest.id, 'name': rest.name}, status=201)


@extend_schema(
	methods=['DELETE'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {'rest_id': {'type': 'integer'}},
			'required': ['rest_id']
		}
	},
	responses={200: {'description': 'Restriction deleted'}}
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def rest_delete(request, rest_id: int):
	try:
		rest = DietaryRestriction.objects.get(id=rest_id, user=request.user)
	except DietaryRestriction.DoesNotExist:
		return Response({'error': 'Restriction not found'}, status=404)

	rest.delete()
	return Response({'message': f'Restriction {rest_id} deleted'})


@extend_schema(
    methods=['GET'],
    parameters=[
        OpenApiParameter(name='q', description='Search prefix (case-insensitive). If omitted returns top 10 by name.', required=False, type=OpenApiTypes.STR),
    ],
    responses={200: {'description': 'List of dietary suggestions'}}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def diet_suggestions(request):
    """
    GET /api/diet_suggestions?q=v
    Returns up to 10 diet suggestions from the DietSuggestion table.
    If `q` is provided, filter by name starting with q (case-insensitive).
    If the DietSuggestion table does not exist, return an empty results list.
    """
    logger.debug('HTTP_AUTHORIZATION: %s', request.META.get('HTTP_AUTHORIZATION'))
    q = (request.GET.get('q') or '').strip()
    try:
        qs = DietSuggestion.objects.all()
        if q:
            qs = qs.filter(name__istartswith=q)
        qs = qs.order_by('name')[:10]
        data = [{'id': p.id, 'name': p.name, 'description': p.description} for p in qs]
        return Response({'results': data})
    except OperationalError:
        # Table might not exist yet — return empty list per requirements
        return Response({'results': []})


@extend_schema(
    methods=['GET'],
    parameters=[
        OpenApiParameter(name='q', description='Search prefix (case-insensitive). If omitted returns top 10 by name.', required=False, type=OpenApiTypes.STR),
    ],
    responses={200: {'description': 'List of ingredient suggestions'}}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ingredient_suggestions(request):
    """
    GET /api/ingredient_suggestions?q=v
    Returns up to 10 ingredient suggestions from the IngredientSuggestion table.
    If `q` is provided, filter by name starting with q (case-insensitive).
    If the IngredientSuggestion table does not exist, return an empty results list.
    """
    logger.debug('HTTP_AUTHORIZATION: %s', request.META.get('HTTP_AUTHORIZATION'))
    q = (request.GET.get('q') or '').strip()
    try:
        qs = IngredientSuggestion.objects.all()
        if q:
            qs = qs.filter(name__istartswith=q)
        qs = qs.order_by('name')[:10]
        data = [{'id': p.id, 'name': p.name, 'description': p.description} for p in qs]
        return Response({'results': data})
    except OperationalError:
        return Response({'results': []})
