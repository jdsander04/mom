from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers
from core.authentication import BearerTokenAuthentication
from core.error_handlers import (
    APIError, ErrorCodes, handle_not_found_error, handle_validation_error,
    handle_external_service_error, safe_api_call
)
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


def normalize_ingredient_for_instacart(name: str) -> str:
	"""Normalize ingredient names for Instacart shopping.
	
	Maps specific ingredient variations to their base form.
	For example: 'egg yolk' -> 'eggs', 'egg' -> 'eggs'
	"""
	name_lower = name.lower().strip()
	
	if 'egg yolk' in name_lower:
		return 'eggs'
	if name_lower == 'egg':
		return 'eggs'
	if name_lower == 'pepper':
		return 'black pepper'
	
	return name


class OrderHistorySerializer(serializers.ModelSerializer):
	class Meta:
		model = OrderHistory
		fields = ['id', 'created_at', 'instacart_url', 'items_data', 'recipe_names', 'top_recipe_image', 'nutrition_data', 'total_price']


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
@safe_api_call
def cart_items(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)

	if request.method == 'POST':
		data = request.data
		recipe_id = data.get('recipe_id')
		ingredient_id = data.get('ingredient_id')
		quantity = data.get('quantity', 1)

		# Validate required fields
		if not recipe_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing recipe_id",
				details="The recipe_id field is required to add an item to the cart."
			).to_response()
		
		if not ingredient_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing ingredient_id",
				details="The ingredient_id field is required to add an item to the cart."
			).to_response()

		# Validate quantity
		try:
			quantity = float(quantity)
			if quantity <= 0:
				return APIError(
					error_code=ErrorCodes.INVALID_QUANTITY,
					message="Invalid quantity",
					details="Quantity must be a positive number greater than 0."
				).to_response()
		except (ValueError, TypeError):
			return APIError(
				error_code=ErrorCodes.INVALID_FIELD_VALUE,
				message="Invalid quantity format",
				details="Quantity must be a valid number."
			).to_response()

		try:
			recipe = Recipe.objects.get(id=recipe_id, user=request.user)
		except Recipe.DoesNotExist:
			return handle_not_found_error("Recipe", recipe_id).to_response()

		try:
			from recipes.models import Ingredient as RecipeIngredient
			recipe_ingredient = RecipeIngredient.objects.get(id=ingredient_id, recipe=recipe)
		except RecipeIngredient.DoesNotExist:
			return APIError(
				error_code=ErrorCodes.RESOURCE_NOT_FOUND,
				message="Ingredient not found",
				details=f"Ingredient with ID '{ingredient_id}' was not found in recipe '{recipe.name}'."
			).to_response()

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
			'message': f"Added {quantity} {ci.unit} of {ci.name} to cart"
		}, status=201)

	elif request.method == 'PATCH':
		item_id = request.data.get('item_id')
		quantity = request.data.get('quantity')

		# Validate required fields
		if not item_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing item_id",
				details="The item_id field is required to update an item."
			).to_response()

		if quantity is None:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing quantity",
				details="The quantity field is required to update an item."
			).to_response()

		# Validate quantity
		try:
			quantity = float(quantity)
			if quantity < 0:
				return APIError(
					error_code=ErrorCodes.INVALID_QUANTITY,
					message="Invalid quantity",
					details="Quantity cannot be negative. Use 0 to remove the item or DELETE method."
				).to_response()
		except (ValueError, TypeError):
			return APIError(
				error_code=ErrorCodes.INVALID_FIELD_VALUE,
				message="Invalid quantity format",
				details="Quantity must be a valid number."
			).to_response()

		try:
			ci = cart.items.get(id=item_id)
		except CartItem.DoesNotExist:
			return APIError(
				error_code=ErrorCodes.CART_ITEM_NOT_FOUND,
				message="Cart item not found",
				details=f"Cart item with ID '{item_id}' was not found in your cart."
			).to_response()

		if quantity == 0:
			item_name = ci.name
			ci.delete()
			return Response({
				'message': f"Removed {item_name} from cart",
				'removed': True
			})
		else:
			ci.quantity = quantity
			ci.save()
			return Response({
				'id': ci.id,
				'quantity': float(ci.quantity),
				'message': f"Updated {ci.name} quantity to {quantity} {ci.unit}"
			})

	else:  # DELETE
		item_id = request.data.get('item_id')
		
		if not item_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing item_id",
				details="The item_id field is required to remove an item."
			).to_response()

		try:
			ci = cart.items.get(id=item_id)
			item_name = ci.name
			ci.delete()
			return Response({
				'message': f"Removed {item_name} from cart"
			}, status=204)
		except CartItem.DoesNotExist:
			return APIError(
				error_code=ErrorCodes.CART_ITEM_NOT_FOUND,
				message="Cart item not found",
				details=f"Cart item with ID '{item_id}' was not found in your cart."
			).to_response()





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
@safe_api_call
def add_recipe_to_cart(request):
	cart, _ = Cart.objects.get_or_create(user=request.user)
	
	if request.method == 'POST':
		recipe_id = request.data.get('recipe_id')
		serving_size = request.data.get('serving_size', 1.0)

		# Validate required fields
		if not recipe_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing recipe_id",
				details="The recipe_id field is required to add a recipe to the cart."
			).to_response()

		# Validate serving size
		try:
			serving_size = float(serving_size)
			if serving_size <= 0:
				return APIError(
					error_code=ErrorCodes.INVALID_FIELD_VALUE,
					message="Invalid serving size",
					details="Serving size must be a positive number greater than 0."
				).to_response()
		except (ValueError, TypeError):
			return APIError(
				error_code=ErrorCodes.INVALID_FIELD_VALUE,
				message="Invalid serving size format",
				details="Serving size must be a valid number."
			).to_response()
		
		try:
			recipe = Recipe.objects.get(id=recipe_id, user=request.user)
		except Recipe.DoesNotExist:
			return handle_not_found_error("Recipe", recipe_id).to_response()

		# Check if recipe already in cart
		cr, created = CartRecipe.objects.get_or_create(
			cart=cart, recipe=recipe, defaults={'serving_size': serving_size}
		)
		if not created:
			return APIError(
				error_code=ErrorCodes.RECIPE_ALREADY_IN_CART,
				message="Recipe already in cart",
				details=f"The recipe '{recipe.name}' is already in your cart. Use PATCH to update serving size."
			).to_response()

		# Add ingredients
		from decimal import Decimal
		ingredients_added = 0
		for ingredient in recipe.ingredients.all():
			scaled_quantity = Decimal(ingredient.quantity) * Decimal(serving_size)
			CartItem.objects.create(
				cart=cart,
				name=ingredient.name,
				quantity=scaled_quantity,
				unit=ingredient.unit or '',
				recipe_ingredient=ingredient,
			)
			ingredients_added += 1

		return Response({
			'message': f"Added '{recipe.name}' to cart with {ingredients_added} ingredients",
			'recipe_name': recipe.name,
			'serving_size': float(serving_size),
			'ingredients_count': ingredients_added
		}, status=201)
	
	elif request.method == 'PATCH':
		recipe_id = request.data.get('recipe_id')
		serving_size = request.data.get('serving_size')

		# Validate required fields
		if not recipe_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing recipe_id",
				details="The recipe_id field is required to update serving size."
			).to_response()

		if serving_size is None:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing serving_size",
				details="The serving_size field is required to update serving size."
			).to_response()

		# Validate serving size
		try:
			serving_size = float(serving_size)
			if serving_size <= 0:
				return APIError(
					error_code=ErrorCodes.INVALID_FIELD_VALUE,
					message="Invalid serving size",
					details="Serving size must be a positive number greater than 0."
				).to_response()
		except (ValueError, TypeError):
			return APIError(
				error_code=ErrorCodes.INVALID_FIELD_VALUE,
				message="Invalid serving size format",
				details="Serving size must be a valid number."
			).to_response()
		
		try:
			cr = cart.recipes.get(recipe_id=recipe_id)
		except CartRecipe.DoesNotExist:
			return APIError(
				error_code=ErrorCodes.RECIPE_NOT_FOUND,
				message="Recipe not in cart",
				details=f"Recipe with ID '{recipe_id}' is not in your cart. Add it first using POST."
			).to_response()
		
		# Update serving size and scale ingredients
		from decimal import Decimal
		old_serving_size = float(cr.serving_size)
		scale_factor = Decimal(serving_size) / cr.serving_size
		cr.serving_size = serving_size
		cr.save()
		
		# Scale all ingredients for this recipe
		updated_items = 0
		for ci in cart.items.filter(recipe_ingredient__recipe_id=recipe_id):
			ci.quantity = ci.quantity * scale_factor
			ci.save()
			updated_items += 1
		
		return Response({
			'message': f"Updated '{cr.recipe.name}' serving size from {old_serving_size}x to {serving_size}x",
			'recipe_name': cr.recipe.name,
			'old_serving_size': old_serving_size,
			'new_serving_size': float(serving_size),
			'updated_items': updated_items
		})
	
	else:  # DELETE
		recipe_id = request.data.get('recipe_id')

		if not recipe_id:
			return APIError(
				error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
				message="Missing recipe_id",
				details="The recipe_id field is required to remove a recipe from cart."
			).to_response()
		
		try:
			cr = cart.recipes.get(recipe_id=recipe_id)
			recipe_name = cr.recipe.name
			
			# Count items to be removed
			items_to_remove = cart.items.filter(recipe_ingredient__recipe_id=recipe_id).count()
			
			# Remove all ingredients for this recipe
			cart.items.filter(recipe_ingredient__recipe_id=recipe_id).delete()
			# Remove recipe from cart
			cr.delete()
			
			return Response({
				'message': f"Removed '{recipe_name}' and {items_to_remove} ingredients from cart",
				'recipe_name': recipe_name,
				'removed_items': items_to_remove
			}, status=204)
		except CartRecipe.DoesNotExist:
			return APIError(
				error_code=ErrorCodes.RECIPE_NOT_FOUND,
				message="Recipe not in cart",
				details=f"Recipe with ID '{recipe_id}' is not in your cart."
			).to_response()


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
@safe_api_call
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
			normalized_name = normalize_ingredient_for_instacart(ci.name)
			key = f"{normalized_name}-{ci.unit}"
			if key in combined:
				combined[key]['quantity'] += float(ci.quantity)
			else:
				combined[key] = {
					'name': normalized_name,
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
		return APIError(
			error_code=ErrorCodes.EXTERNAL_SERVICE_ERROR,
			message="Instacart service not configured",
			details="The Instacart integration is not properly configured. Please contact support."
		).to_response()
	
	# Strip whitespace in case there are leading/trailing spaces
	api_key = api_key.strip()
	
	# Get enable_pantry_items from request, default to True
	enable_pantry_items = request.data.get('enable_pantry_items', True)
	
	# Get recipe data for this order
	cart_recipes = cart.recipes.select_related('recipe').all()
	
	# Use first recipe or create a combined recipe
	if cart_recipes.count() == 1:
		# Single recipe - use its data
		recipe = cart_recipes[0].recipe
		title = recipe.name
		image_url = recipe.image_url or ''
		instructions = [step.description for step in recipe.steps.order_by('order')]
	else:
		# Multiple recipes - create combined title
		from datetime import datetime
		current_date = datetime.now().strftime('%Y-%m-%d')
		title = f"{current_date} - {request.user.username}"
		image_url = cart_recipes[0].recipe.image_url if cart_recipes and cart_recipes[0].recipe.image_url else ''
		instructions = [f"Prepare {cr.recipe.name}" for cr in cart_recipes]
	
	# Format ingredients for Instacart API
	ingredients = []
	for ingredient in combined.values():
		ingredients.append({
			'name': ingredient['name'],
			'display_text': ingredient['name'].title(),
			'measurements': [{
				'quantity': ingredient['quantity'],
				'unit': ingredient['unit'] or ''
			}]
		})
	
	payload = {
		'title': title,
		'image_url': image_url,
		'link_type': 'recipe',
		'instructions': instructions,
		'ingredients': ingredients,
		'landing_page_configuration': {
			'enable_pantry_items': enable_pantry_items
		}
	}
	
	recipe_names = [cr.recipe.name for cr in cart_recipes]
	
	# Get top recipe image (first recipe with image)
	top_recipe_image = None
	for cr in cart_recipes:
		if cr.recipe.image_url:
			top_recipe_image = cr.recipe.image_url
			break
	
	# Calculate total nutrition
	nutrition_totals = {}
	for cr in cart_recipes:
		for nutrient in cr.recipe.nutrients.all():
			macro = nutrient.macro
			if macro in nutrition_totals:
				nutrition_totals[macro] += float(nutrient.mass) * float(cr.serving_size)
			else:
				nutrition_totals[macro] = float(nutrient.mass) * float(cr.serving_size)
	
	# Store order history before sending to Instacart
	order_history = OrderHistory.objects.create(
		user=request.user,
		items_data=payload,
		recipe_names=recipe_names,
		top_recipe_image=top_recipe_image,
		nutrition_data=nutrition_totals
	)
	
	try:
		logger.info(f'Making Instacart API request with {len(ingredients)} items')
		response = requests.post(
			'https://connect.dev.instacart.tools/idp/v1/products/recipe',
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
			# Try different possible URL field names
			recipe_url = (data.get('recipe_url') or data.get('url') or 
			             data.get('link') or data.get('recipe_link') or
			             data.get('products_link_url') or data.get('recipe_page_url'))
			# Update order history with Instacart URL
			order_history.instacart_url = recipe_url
			order_history.save()
			return Response({
				'success': True,
				'redirect_url': recipe_url,
				'message': f"Successfully created Instacart recipe with {len(ingredients)} items"
			})
		else:
			try:
				error_data = response.json()
				error_msg = error_data.get('message', f'HTTP {response.status_code}')
				error_details = error_data.get('error', '')
				if error_details:
					error_msg = f'{error_msg}: {error_details}'
				logger.error(f'Instacart API error: {error_msg} (status {response.status_code})')
				logger.error(f'Response body: {error_data}')
				
				if response.status_code == 400:
					details = f"Invalid request to Instacart API: {error_msg}. Please check your cart items and try again."
				elif response.status_code == 401:
					details = "Authentication failed with Instacart API. Please contact support."
				elif response.status_code == 403:
					details = "Access denied by Instacart API. Please contact support."
				elif response.status_code == 429:
					details = "Too many requests to Instacart API. Please wait a moment and try again."
				else:
					details = f"Instacart API returned an error: {error_msg}"
			except:
				error_msg = f'HTTP {response.status_code}'
				logger.error(f'Instacart API error: {error_msg}')
				logger.error(f'Response text: {response.text[:200]}')
				details = f"Instacart API returned status {response.status_code}. Please try again later."
			
			return handle_external_service_error("Instacart", details).to_response()
			
	except requests.RequestException as e:
		logger.error(f'Instacart API connection error: {e}')
		return handle_external_service_error(
			"Instacart", 
			"Unable to connect to Instacart API. Please check your internet connection and try again."
		).to_response()


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


@extend_schema(
	methods=['POST'],
	responses={201: {'description': 'Order re-added to cart'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def reorder(request, order_id):
	"""Re-add a previous order to cart"""
	try:
		order = OrderHistory.objects.get(id=order_id, user=request.user)
	except OrderHistory.DoesNotExist:
		return Response({'error': 'Order not found'}, status=404)
	
	cart, _ = Cart.objects.get_or_create(user=request.user)
	added_recipes = []
	
	for recipe_name in order.recipe_names:
		try:
			recipe = Recipe.objects.get(name=recipe_name, user=request.user)
			cr, created = CartRecipe.objects.get_or_create(
				cart=cart, recipe=recipe, defaults={'serving_size': 1.0}
			)
			if created:
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
		except Recipe.DoesNotExist:
			continue
	
	return Response({
		'message': f'Re-added {len(added_recipes)} recipes to cart',
		'recipes': added_recipes
	}, status=201)


@extend_schema(
	methods=['POST'],
	responses={200: {'description': 'Price updated'}},
)
@extend_schema(tags=['Cart'])
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def set_order_price(request, order_id):
	"""Set the price for an order"""
	try:
		order = OrderHistory.objects.get(id=order_id, user=request.user)
	except OrderHistory.DoesNotExist:
		return Response({'error': 'Order not found'}, status=404)
	
	price = request.data.get('price')
	if price is None:
		return Response({'error': 'Price is required'}, status=400)
	
	try:
		from health.models import Budget
		from decimal import Decimal
		
		new_price = Decimal(str(price))
		old_price = order.total_price or Decimal('0')
		price_difference = new_price - old_price
		
		# Update order price
		order.total_price = new_price
		order.save()
		
		# Update user's budget spent amount
		budget, _ = Budget.objects.get_or_create(user=request.user)
		budget.spent = (budget.spent or Decimal('0')) + price_difference
		budget.save()
		
		return Response({'message': 'Price updated successfully'})
	except (ValueError, TypeError):
		return Response({'error': 'Invalid price format'}, status=400)


@extend_schema(
	methods=['DELETE'],
	responses={204: {'description': 'Order deleted'}},
)
@extend_schema(tags=['Cart'])
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def delete_order(request, order_id):
	"""Delete an order from history"""
	try:
		order = OrderHistory.objects.get(id=order_id, user=request.user)
		order.delete()
		return Response(status=204)
	except OrderHistory.DoesNotExist:
		return Response({'error': 'Order not found'}, status=404)