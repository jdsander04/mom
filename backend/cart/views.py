from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from core.authentication import BearerTokenAuthentication
from drf_spectacular.utils import extend_schema

from .models import Cart, CartItem, CartRecipe
from recipes.models import Recipe


@extend_schema(
	methods=['GET'],
	responses={200: {'description': 'Get cart contents'}},
)
@extend_schema(tags=['Cart'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def cart_detail(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)
	recipes = []
	for cr in cart.recipes.select_related('recipe').all():
		ingredients = [
			{
				'id': ci.id,
				'name': ci.name,
				'quantity': float(ci.quantity),
				'unit': ci.unit,
			}
			for ci in cart.items.filter(recipe_ingredient__recipe=cr.recipe)
		]
		recipes.append({
			'recipe_id': cr.recipe_id,
			'name': cr.recipe.name,
			'serving_size': float(cr.serving_size),
			'ingredients': ingredients,
		})
	return Response({'recipes': recipes})


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'recipe_id': {'type': 'integer'},
				'ingredient_id': {'type': 'integer'},
				'quantity': {'type': 'number'},
			},
			'required': ['recipe_id', 'ingredient_id']
		}
	},
	responses={201: {'description': 'Item added to cart'}},
)
@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'item_id': {'type': 'integer'},
				'quantity': {'type': 'number'},
			},
			'required': ['item_id', 'quantity']
		}
	},
	responses={200: {'description': 'Item quantity updated'}},
)
@extend_schema(
	methods=['DELETE'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'item_id': {'type': 'integer'},
			},
			'required': ['item_id']
		}
	},
	responses={204: {'description': 'Item removed from cart'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def cart_items(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)

	if request.method == 'POST':
		data = request.data
		recipe_id = data.get('recipe_id')
		ingredient_id = data.get('ingredient_id')
		quantity = data.get('quantity', 1)

		try:
			recipe = Recipe.objects.get(id=recipe_id, user=request.user)
			from recipes.models import Ingredient as RecipeIngredient
			recipe_ingredient = RecipeIngredient.objects.get(id=ingredient_id, recipe=recipe)
		except (Recipe.DoesNotExist, RecipeIngredient.DoesNotExist):
			return Response({'error': 'Recipe or ingredient not found'}, status=404)

		ci, created = CartItem.objects.get_or_create(
			cart=cart,
			recipe_ingredient=recipe_ingredient,
			defaults={
				'name': recipe_ingredient.name,
				'quantity': quantity,
				'unit': recipe_ingredient.unit or '',
			}
		)
		if not created:
			ci.quantity += quantity
			ci.save()

		return Response({
			'id': ci.id,
			'name': ci.name,
			'quantity': float(ci.quantity),
			'unit': ci.unit,
		}, status=201)

	elif request.method == 'PATCH':
		item_id = request.data.get('item_id')
		quantity = request.data.get('quantity')

		try:
			ci = cart.items.get(id=item_id)
			ci.quantity = quantity
			ci.save()
			return Response({'id': ci.id, 'quantity': float(ci.quantity)})
		except CartItem.DoesNotExist:
			return Response({'error': 'Item not found'}, status=404)

	else:  # DELETE
		item_id = request.data.get('item_id')
		try:
			cart.items.get(id=item_id).delete()
			return Response(status=204)
		except CartItem.DoesNotExist:
			return Response({'error': 'Item not found'}, status=404)





@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'recipe_id': {'type': 'integer'},
				'serving_size': {'type': 'number'},
			},
			'required': ['recipe_id']
		}
	},
	responses={201: {'description': 'Recipe added to cart'}},
)
@extend_schema(
	methods=['PATCH'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'recipe_id': {'type': 'integer'},
				'serving_size': {'type': 'number'},
			},
			'required': ['recipe_id', 'serving_size']
		}
	},
	responses={200: {'description': 'Recipe serving size updated'}},
)
@extend_schema(
	methods=['DELETE'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'recipe_id': {'type': 'integer'},
			},
			'required': ['recipe_id']
		}
	},
	responses={204: {'description': 'Recipe removed from cart'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def add_recipe_to_cart(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)
	
	if request.method == 'POST':
		recipe_id = request.data.get('recipe_id')
		serving_size = request.data.get('serving_size', 1.0)
		
		try:
			recipe = Recipe.objects.get(id=recipe_id, user=request.user)
		except Recipe.DoesNotExist:
			return Response({'error': 'Recipe not found'}, status=404)

		# Create or get cart recipe
		cr, created = CartRecipe.objects.get_or_create(
			cart=cart, recipe=recipe, defaults={'serving_size': serving_size}
		)
		if not created:
			return Response({'error': 'Recipe already in cart'}, status=400)

		# Add ingredients
		from decimal import Decimal
		for ingredient in recipe.ingredients.all():
			scaled_quantity = Decimal(ingredient.quantity) * Decimal(serving_size)
			CartItem.objects.create(
				cart=cart,
				name=ingredient.name,
				quantity=scaled_quantity,
				unit=ingredient.unit or '',
				recipe_ingredient=ingredient,
			)

		return Response({'message': 'Recipe added to cart'}, status=201)
	
	elif request.method == 'PATCH':
		recipe_id = request.data.get('recipe_id')
		serving_size = request.data.get('serving_size')
		
		try:
			cr = cart.recipes.get(recipe_id=recipe_id)
		except CartRecipe.DoesNotExist:
			return Response({'error': 'Recipe not in cart'}, status=404)
		
		# Update serving size and scale ingredients
		from decimal import Decimal
		scale_factor = Decimal(serving_size) / cr.serving_size
		cr.serving_size = serving_size
		cr.save()
		
		# Scale all ingredients for this recipe
		for ci in cart.items.filter(recipe_ingredient__recipe_id=recipe_id):
			ci.quantity = ci.quantity * scale_factor
			ci.save()
		
		return Response({'message': 'Serving size updated'}, status=200)
	
	else:  # DELETE
		recipe_id = request.data.get('recipe_id')
		
		try:
			cr = cart.recipes.get(recipe_id=recipe_id)
			# Remove all ingredients for this recipe
			cart.items.filter(recipe_ingredient__recipe_id=recipe_id).delete()
			# Remove recipe from cart
			cr.delete()
		except CartRecipe.DoesNotExist:
			return Response({'error': 'Recipe not in cart'}, status=404)
		
		return Response(status=204)



