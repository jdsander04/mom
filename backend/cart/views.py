from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from core.authentication import BearerTokenAuthentication
from drf_spectacular.utils import extend_schema
import requests
import os
import logging

from .models import Cart, CartItem, CartRecipe
from .order_models import OrderHistory
from recipes.models import Recipe
from meal_calendar.models import MealPlan
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class OrderHistorySerializer(serializers.ModelSerializer):
	class Meta:
		model = OrderHistory
		fields = ['id', 'created_at', 'instacart_url', 'items_data']


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
				'recipe_ingredient_id': ci.recipe_ingredient_id,
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


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {},
			'description': 'No request body required - uses current cart contents'
		}
	},
	responses={
		200: {
			'description': 'Instacart shopping list created successfully',
			'content': {
				'application/json': {
					'schema': {
						'type': 'object',
						'properties': {
							'success': {'type': 'boolean'},
							'redirect_url': {'type': 'string', 'format': 'uri'}
						}
					}
				}
			}
		},
		400: {
			'description': 'Bad request - API key not configured or Instacart API error',
			'content': {
				'application/json': {
					'schema': {
						'type': 'object',
						'properties': {
							'success': {'type': 'boolean'},
							'error': {'type': 'string'}
						}
					}
				}
			}
		},
		503: {
			'description': 'Service unavailable - Unable to connect to Instacart API',
			'content': {
				'application/json': {
					'schema': {
						'type': 'object',
						'properties': {
							'success': {'type': 'boolean'},
							'error': {'type': 'string'}
						}
					}
				}
			}
		}
	},
	description='Creates an Instacart shopping list from current cart contents and returns a redirect URL'
)
@extend_schema(tags=['Cart'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def create_instacart_list(request):
	"""
	Create Instacart Shopping List
	
	Creates a shopping list on Instacart using the current cart contents.
	Combines ingredients with the same name and unit, then sends them to
	Instacart's API to generate a shopping list link.
	
	Returns:
		- success: Boolean indicating if the operation was successful
		- redirect_url: URL to the created Instacart shopping list
	"""
	cart, _ = Cart.objects.get_or_create(user=request.user)
	
	# Get combined ingredients
	combined = {}
	for cr in cart.recipes.select_related('recipe').all():
		for ci in cart.items.filter(recipe_ingredient__recipe=cr.recipe):
			key = f"{ci.name}-{ci.unit}"
			if key in combined:
				combined[key]['quantity'] += float(ci.quantity)
			else:
				combined[key] = {
					'name': ci.name,
					'quantity': float(ci.quantity),
					'unit': ci.unit
				}
	
	# Prepare Instacart API request
	items = []
	for ingredient in combined.values():
		items.append({
			'name': ingredient['name'],
			'quantity': ingredient['quantity'],
			'unit': ingredient['unit']
		})
	
	payload = {
		'name': f"Recipe Shopping List - {request.user.username}",
		'items': items
	}
	
	api_key = os.getenv('INSTACART_API_KEY')
	if not api_key:
		logger.error('INSTACART_API_KEY not found in environment variables')
		return Response({'success': False, 'error': 'API key not configured'}, status=400)
	
	# Strip whitespace in case there are leading/trailing spaces
	api_key = api_key.strip()
	
	# Format ingredients for Instacart API
	line_items = []
	for ingredient in combined.values():
		line_items.append({
			'name': ingredient['name'],
			'quantity': int(ingredient['quantity']) if ingredient['quantity'].is_integer() else ingredient['quantity'],
			'unit': ingredient['unit'] or 'item'
		})
	
	payload = {
		'title': f"Recipe Shopping List - {request.user.username}",
		'line_items': line_items
	}
	
	# Store order history before sending to Instacart
	order_history = OrderHistory.objects.create(
		user=request.user,
		items_data=payload
	)
	
	try:
		logger.info(f'Making Instacart API request with {len(line_items)} items')
		response = requests.post(
			'https://connect.dev.instacart.tools/idp/v1/products/products_link',
			headers={
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'Authorization': f'Bearer {api_key}'
			},
			json=payload,
			timeout=10
		)
		
		logger.info(f'Instacart API response status: {response.status_code}')
		
		if response.status_code == 200:
			data = response.json()
			# Update order history with Instacart URL
			order_history.instacart_url = data.get('products_link_url')
			order_history.save()
			return Response({
				'success': True,
				'redirect_url': data.get('products_link_url')
			})
		else:
			try:
				error_data = response.json()
				error_msg = error_data.get('message', f'Status {response.status_code}')
				error_details = error_data.get('error', '')
				if error_details:
					error_msg = f'{error_msg}: {error_details}'
				logger.error(f'Instacart API error: {error_msg} (status {response.status_code})')
				logger.error(f'Response body: {error_data}')
			except:
				error_msg = f'Status {response.status_code}'
				logger.error(f'Instacart API error: {error_msg}')
				logger.error(f'Response text: {response.text[:200]}')
			return Response({
				'success': False,
				'error': f'Instacart API error: {error_msg}'
			}, status=response.status_code if response.status_code < 500 else 503)
			
	except requests.RequestException as e:
		return Response({
			'success': False,
			'error': 'Unable to connect to Instacart API'
		}, status=503)


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'dates': {
					'type': 'array',
					'items': {'type': 'string', 'format': 'date'},
					'description': 'Array of dates in YYYY-MM-DD format'
				}
			},
			'required': ['dates']
		}
	},
	responses={201: {'description': 'Meal plans added to cart'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def add_meal_plans_to_cart(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)
	dates = request.data.get('dates', [])
	
	added_recipes = []
	for date_str in dates:
		try:
			meal_plan = MealPlan.objects.get(user=request.user, date=date_str)
			for meal_type in ['breakfast', 'lunch', 'dinner', 'snacks']:
				meals = getattr(meal_plan, meal_type, [])
				for meal in meals:
					if isinstance(meal, dict) and meal.get('id'):
						try:
							recipe = Recipe.objects.get(id=meal['id'], user=request.user)
							cr, created = CartRecipe.objects.get_or_create(
								cart=cart, recipe=recipe, defaults={'serving_size': 1.0}
							)
							if created:
								# New recipe - add ingredients
								from decimal import Decimal
								for ingredient in recipe.ingredients.all():
									CartItem.objects.create(
										cart=cart,
										name=ingredient.name,
										quantity=ingredient.quantity,
										unit=ingredient.unit or '',
										recipe_ingredient=ingredient,
									)
								added_recipes.append(recipe.name)
							else:
								# Recipe already exists - scale up
								from decimal import Decimal
								cr.serving_size += Decimal('1.0')
								cr.save()
								
								# Scale existing ingredients
								for ci in cart.items.filter(recipe_ingredient__recipe=recipe):
									original_quantity = Decimal(str(ci.recipe_ingredient.quantity))
									ci.quantity = original_quantity * cr.serving_size
									ci.save()
								
								added_recipes.append(f"{recipe.name} (scaled to {float(cr.serving_size)}x)")
						except Recipe.DoesNotExist:
							continue
		except MealPlan.DoesNotExist:
			continue
	
	return Response({
		'message': f'Added {len(added_recipes)} recipes to cart',
		'recipes': added_recipes
	}, status=201)


@extend_schema(
	methods=['POST'],
	request={
		'application/json': {
			'type': 'object',
			'properties': {
				'start_date': {'type': 'string', 'format': 'date'},
				'end_date': {'type': 'string', 'format': 'date'}
			},
			'required': ['start_date', 'end_date']
		}
	},
	responses={201: {'description': 'Week of meal plans added to cart'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def add_week_to_cart(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)
	start_date = datetime.strptime(request.data.get('start_date'), '%Y-%m-%d').date()
	end_date = datetime.strptime(request.data.get('end_date'), '%Y-%m-%d').date()
	
	dates = []
	current_date = start_date
	while current_date <= end_date:
		dates.append(current_date.strftime('%Y-%m-%d'))
		current_date += timedelta(days=1)
	
	added_recipes = []
	for date_str in dates:
		try:
			meal_plan = MealPlan.objects.get(user=request.user, date=date_str)
			for meal_type in ['breakfast', 'lunch', 'dinner', 'snacks']:
				meals = getattr(meal_plan, meal_type, [])
				for meal in meals:
					if isinstance(meal, dict) and meal.get('id'):
						try:
							recipe = Recipe.objects.get(id=meal['id'], user=request.user)
							cr, created = CartRecipe.objects.get_or_create(
								cart=cart, recipe=recipe, defaults={'serving_size': 1.0}
							)
							if created:
								# New recipe - add ingredients
								from decimal import Decimal
								for ingredient in recipe.ingredients.all():
									CartItem.objects.create(
										cart=cart,
										name=ingredient.name,
										quantity=ingredient.quantity,
										unit=ingredient.unit or '',
										recipe_ingredient=ingredient,
									)
								added_recipes.append(recipe.name)
							else:
								# Recipe already exists - scale up
								from decimal import Decimal
								cr.serving_size += Decimal('1.0')
								cr.save()
								
								# Scale existing ingredients
								for ci in cart.items.filter(recipe_ingredient__recipe=recipe):
									original_quantity = Decimal(str(ci.recipe_ingredient.quantity))
									ci.quantity = original_quantity * cr.serving_size
									ci.save()
								
								added_recipes.append(f"{recipe.name} (scaled to {float(cr.serving_size)}x)")
						except Recipe.DoesNotExist:
							continue
		except MealPlan.DoesNotExist:
			continue
	
	return Response({
		'message': f'Added {len(added_recipes)} recipes to cart',
		'recipes': added_recipes
	}, status=201)


@extend_schema(
	methods=['GET'],
	responses={200: OrderHistorySerializer(many=True)},
)
@extend_schema(tags=['Cart'])
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def order_history(request):
	"""Get user's order history"""
	orders = OrderHistory.objects.filter(user=request.user)
	serializer = OrderHistorySerializer(orders, many=True)
	return Response(serializer.data)