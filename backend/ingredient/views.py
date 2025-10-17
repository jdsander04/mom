from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from core.authentication import BearerTokenAuthentication
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from .models import Ingredient
from .serializers import IngredientSerializer


@extend_schema(
	methods=['GET'],
	operation_id='ingredient_list',
	responses={200: {'description': 'List of ingredients'}}
)
@extend_schema(
	methods=['POST'],
	request=IngredientSerializer,
	responses={201: IngredientSerializer}
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def ingredient_list(request):
	if request.method == 'GET':
		ingredients = Ingredient.objects.all()
		serializer = IngredientSerializer(ingredients, many=True, context={'request': request})
		return Response({'ingredients': serializer.data})

	# POST: create
	serializer = IngredientSerializer(data=request.data, context={'request': request})
	if serializer.is_valid():
		serializer.save()
		return Response(serializer.data, status=201)
	return Response(serializer.errors, status=400)


@extend_schema(
	methods=['GET'],
	operation_id='ingredient_detail',
	responses={200: IngredientSerializer}
)
@extend_schema(
	methods=['PATCH'],
	request=IngredientSerializer,
	responses={200: IngredientSerializer}
)
@extend_schema(
	methods=['DELETE'],
	responses={204: {'description': 'Deleted'}}
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def ingredient_detail(request, ingredient_id):
	try:
		ingredient = Ingredient.objects.get(id=ingredient_id)
	except Ingredient.DoesNotExist:
		return Response({'error': 'Ingredient not found'}, status=404)

	if request.method == 'GET':
		serializer = IngredientSerializer(ingredient, context={'request': request})
		return Response(serializer.data)

	if request.method == 'PATCH':
		serializer = IngredientSerializer(ingredient, data=request.data, partial=True, context={'request': request})
		if serializer.is_valid():
			serializer.save()
			return Response(serializer.data)
		return Response(serializer.errors, status=400)

	# DELETE
	ingredient.delete()
	return Response(status=204)
