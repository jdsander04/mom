from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from core.authentication import BearerTokenAuthentication
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Recipe, Ingredient, Step, Nutrient
from .services import recipe_from_url, recipe_from_file

@extend_schema(
    methods=['GET'],
    operation_id='recipe_list',
    responses={200: {'description': 'List of recipes'}}
)
@extend_schema(
    methods=['POST'],
    request={
        'application/json': {
            'oneOf': [
                {
                    'type': 'object',
                    'properties': {
                        'recipe_source': {'type': 'string', 'enum': ['url']},
                        'url': {'type': 'string', 'example': 'https://example.com/recipe'}
                    },
                    'required': ['recipe_source', 'url']
                },
                {
                    'type': 'object',
                    'properties': {
                        'recipe_source': {'type': 'string', 'enum': ['explicit']},
                        'name': {'type': 'string', 'example': 'Chocolate Chip Cookies'},
                        'description': {'type': 'string', 'example': 'Classic cookies'},
                        'ingredients': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'name': {'type': 'string'},
                                    'quantity': {'type': 'number'},
                                    'unit': {'type': 'string'}
                                }
                            }
                        },
                        'steps': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'description': {'type': 'string'}
                                }
                            }
                        }
                    },
                    'required': ['recipe_source']
                }
            ]
        },
    },
    responses={
        201: {
            'description': 'Recipe created successfully',
            'content': {
                'application/json': {
                    'example': {'id': 1, 'name': 'Recipe Name'}
                }
            }
        }
    }
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
# General recipe endpoints
def recipe_list(request):
    # Get list of all recipe IDs
    if request.method == 'GET':
        recipes = Recipe.objects.filter(user=request.user)
        recipe_data = [{'id': r.id, 'name': r.name} for r in recipes]
        return Response({'recipes': recipe_data})
    
    # Create new recipe
    elif request.method == 'POST':
        recipe_source = request.data.get('recipe_source')

        if recipe_source == 'url':
            url = request.data.get('url', '').strip()
            if not url:
                return Response({'error': 'URL required for url source'}, status=400)
            
            # Basic URL validation
            from urllib.parse import urlparse
            try:
                parsed = urlparse(url)
                if not parsed.scheme in ['http', 'https'] or not parsed.netloc:
                    return Response({'error': 'Invalid URL format'}, status=400)
            except Exception:
                return Response({'error': 'Invalid URL format'}, status=400)
            
            try:
                recipe_data = recipe_from_url(url)
                print(f"VIEWS: Recipe data received: {recipe_data}")
                print(f"VIEWS: Recipe data type: {type(recipe_data)}")
                if recipe_data:
                    print(f"VIEWS: Recipe data keys: {list(recipe_data.keys())}")
                    print(f"VIEWS: Title: {recipe_data.get('title')}")
                    print(f"VIEWS: Ingredients: {recipe_data.get('ingredients')}")
                    print(f"VIEWS: Instructions: {recipe_data.get('instructions_list')}")
                
                if not recipe_data:
                    return Response({'error': 'No recipe data returned from URL'}, status=400)
                # Make title validation less strict - allow empty title
                title = recipe_data.get('title') or recipe_data.get('name') or 'Untitled Recipe'
                print(f"VIEWS: Final title: {title}")
            except Exception as e:
                print(f"VIEWS: Recipe extraction error: {e}")
                import traceback
                print(f"VIEWS: Traceback: {traceback.format_exc()}")
                return Response({'error': f'Failed to process recipe URL: {str(e)}'}, status=500)
            
            recipe = Recipe.objects.create(
                user=request.user,
                name=title,
                description=recipe_data.get('description', ''),
                image_url=recipe_data.get('image', ''),
                source_url=url
            )
            
            # Create ingredients - handle both string and dict formats
            ingredients_data = recipe_data.get('ingredients', [])
            for ingredient in ingredients_data:
                try:
                    if isinstance(ingredient, str):
                        # Parse ingredient string (e.g., "2 cups flour")
                        parts = ingredient.split()
                        if len(parts) >= 3:
                            try:
                                quantity = float(parts[0])
                                unit = parts[1][:50]  # Limit length
                                name = ' '.join(parts[2:])[:255]  # Limit length
                            except ValueError:
                                quantity = 0
                                unit = ''
                                name = ingredient[:255]
                        else:
                            quantity = 0
                            unit = ''
                            name = ingredient[:255]
                    else:
                        # Handle dict format
                        name = str(ingredient.get('name', ''))[:255]
                        quantity = float(ingredient.get('quantity', 0))
                        unit = str(ingredient.get('unit', ''))[:50]
                    
                    if name.strip():  # Only create if name exists
                        Ingredient.objects.create(
                            recipe=recipe,
                            name=name.strip(),
                            quantity=max(0, quantity),
                            unit=unit.strip()
                        )
                except (ValueError, TypeError) as e:
                    continue  # Skip invalid ingredients
            
            # Create steps
            instructions = recipe_data.get('instructions_list', [])
            if not instructions and recipe_data.get('instructions'):
                # Handle single instruction string
                instructions = [recipe_data.get('instructions')]
            
            for i, instruction in enumerate(instructions, 1):
                if instruction and isinstance(instruction, str):
                    Step.objects.create(
                        recipe=recipe,
                        description=str(instruction)[:1000],  # Limit length
                        order=i
                    )
            
            # Create nutrients
            nutrients = recipe_data.get('nutrients', {})
            if isinstance(nutrients, dict):
                for macro, mass in nutrients.items():
                    try:
                        if isinstance(mass, str):
                            mass_value = float(mass.split()[0]) if mass and mass.split() else 0
                        else:
                            mass_value = float(mass) if mass else 0
                        
                        if macro and mass_value >= 0:
                            Nutrient.objects.create(
                                recipe=recipe,
                                macro=str(macro)[:255],
                                mass=mass_value
                            )
                    except (ValueError, TypeError, AttributeError):
                        continue  # Skip invalid nutrients
            
        elif recipe_source == 'file':
            file = request.FILES.get('file')
            if not file:
                return Response({'error': 'File required for file source'}, status=400)
            recipe_data = recipe_from_file(file)
            if not recipe_data:
                return Response({'error': 'Failed to process file'}, status=400)
            recipe = Recipe.objects.create(
                user=request.user,
                name=recipe_data.get('title', ''),
                description=recipe_data.get('description', '')
            )
            
            # Create ingredients
            for ingredient in recipe_data.get('ingredients', []):
                Ingredient.objects.create(
                    recipe=recipe,
                    name=ingredient.get('name', ''),
                    quantity=ingredient.get('quantity', 0),
                    unit=ingredient.get('unit', '')
                )
            
            # Create steps
            for i, instruction in enumerate(recipe_data.get('instructions', []), 1):
                Step.objects.create(
                    recipe=recipe,
                    description=instruction,
                    order=i
                )
            
        elif recipe_source == 'explicit':
            recipe = Recipe.objects.create(
                user=request.user,
                name=request.data.get('name', ''),
                description=request.data.get('description', '')
            )
            
            for ing_data in request.data.get('ingredients', []):
                Ingredient.objects.create(
                    recipe=recipe,
                    name=ing_data.get('name', ''),
                    quantity=ing_data.get('quantity', 0),
                    unit=ing_data.get('unit', '')
                )
            
            for i, step_data in enumerate(request.data.get('steps', []), 1):
                Step.objects.create(
                    recipe=recipe,
                    description=step_data.get('description', ''),
                    order=i
                )
                
        else:
            return Response({'error': 'Expected "url", "file", or "explicit"'}, status=400)

        # Return complete recipe data after creation
        created_recipe = {
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'image_url': recipe.image_url,
            'source_url': recipe.source_url,
            'ingredients': [
                {'name': i.name, 'quantity': float(i.quantity), 'unit': i.unit}
                for i in recipe.ingredients.all()
            ],
            'steps': [
                {'description': s.description, 'order': s.order}
                for s in recipe.steps.all().order_by('order')
            ],
            'nutrients': [
                {'macro': n.macro, 'mass': float(n.mass)}
                for n in recipe.nutrients.all()
            ]
        }
        return Response(created_recipe, status=201)

@extend_schema(
    methods=['GET'],
    operation_id='recipe_detail',
    responses={
        200: {
            'description': 'Recipe details',
            'content': {
                'application/json': {
                    'example': {
                        'id': 1,
                        'name': 'Recipe Name',
                        'description': 'Recipe description',
                        'ingredients': [{'name': 'flour', 'quantity': 2, 'unit': 'cups'}],
                        'steps': [{'description': 'Mix ingredients'}]
                    }
                }
            }
        }
    }
)
@extend_schema(
    methods=['PATCH'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'name': {'type': 'string', 'description': 'Recipe name'},
                'description': {'type': 'string', 'description': 'Recipe description'},
                'ingredients': {
                    'type': 'array',
                    'description': 'Updated ingredients list',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'name': {'type': 'string'},
                            'quantity': {'type': 'number'},
                            'unit': {'type': 'string'}
                        }
                    }
                },
                'steps': {
                    'type': 'array',
                    'description': 'Updated cooking steps',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'description': {'type': 'string'}
                        }
                    }
                }
            }
        },
    },
    responses={200: {'description': 'Recipe updated successfully'}}
)
@extend_schema(
    methods=['DELETE'],
    responses={200: {'description': 'Recipe deleted successfully'}}
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
def recipe_detail(request, recipe_id):
    try:
        recipe = Recipe.objects.get(id=recipe_id, user=request.user)
    except Recipe.DoesNotExist:
        return Response({'error': 'Recipe not found'}, status=404)
    

    # Get specific recipe info
    if request.method == 'GET':
        recipe_data = {
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'image_url': recipe.image_url,
            'source_url': recipe.source_url,
            'ingredients': [
                {'name': i.name, 'quantity': float(i.quantity), 'unit': i.unit}
                for i in recipe.ingredients.all()
            ],
            'steps': [
                {'description': s.description, 'order': s.order}
                for s in recipe.steps.all().order_by('order')
            ],
            'nutrients': [
                {'macro': n.macro, 'mass': float(n.mass)}
                for n in recipe.nutrients.all()
            ]
        }
        return Response(recipe_data)
    
    # Update existing recipe
    elif request.method == 'PATCH':
        # based on recipe id, update fields if provided
        name = request.data.get('name')
        description = request.data.get('description')
        ingredients = request.data.get('ingredients')
        steps = request.data.get('steps')

        if name:
            recipe.name = name
        if description:
            recipe.description = description
        recipe.save()

        if ingredients is not None:
            recipe.ingredients.all().delete()
            for ing_data in ingredients:
                Ingredient.objects.create(
                    recipe=recipe,
                    name=ing_data.get('name', ''),
                    quantity=ing_data.get('quantity', 0),
                    unit=ing_data.get('unit', '')
                )
        if steps is not None:
            recipe.steps.all().delete()
            for i, step_data in enumerate(steps, 1):
                Step.objects.create(
                    recipe=recipe,
                    description=step_data.get('description', ''),
                    order=i
                )
        
        return Response({'message': f'Recipe {recipe_id} edited'})
    
    # Delete specific recipe
    elif request.method == 'DELETE':
        # delete recipe based on recipe id
        recipe.delete()
        return Response(status=204)

