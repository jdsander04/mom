from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Recipe, Ingredient, Step, Nutrient
from .services import recipe_from_url, recipe_from_file

@extend_schema(
    methods=['GET'],
    responses={200: {'description': 'List of recipes'}}
)
@extend_schema(
    methods=['POST'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'recipe_source': {
                    'type': 'string',
                    'enum': ['url', 'file', 'explicit'],
                    'description': 'Source type for the recipe'
                },
                'url': {
                    'type': 'string',
                    'description': 'Recipe URL (required for url source)',
                    'example': 'https://example.com/recipe'
                },
                'name': {
                    'type': 'string', 
                    'description': 'Recipe name (required for explicit source)',
                    'example': 'Chocolate Chip Cookies'
                },
                'description': {
                    'type': 'string', 
                    'description': 'Recipe description (for explicit source)',
                    'example': 'Classic homemade chocolate chip cookies'
                },
                'ingredients': {
                    'type': 'array',
                    'description': 'Ingredients list (for explicit source)',
                    'example': [
                        {'name': 'flour', 'quantity': 2, 'unit': 'cups'},
                        {'name': 'sugar', 'quantity': 1, 'unit': 'cup'}
                    ],
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
                    'description': 'Cooking steps (for explicit source)',
                    'example': [
                        {'description': 'Preheat oven to 375°F'},
                        {'description': 'Mix ingredients and bake'}
                    ],
                    'items': {
                        'type': 'object',
                        'properties': {
                            'description': {'type': 'string'}
                        }
                    }
                }
            },
            'required': ['recipe_source']
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
@authentication_classes([TokenAuthentication])
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
            url = request.data.get('url')
            if not url:
                return Response({'error': 'URL required for url source'}, status=400)
            recipe_data = recipe_from_url(url)
            recipe = Recipe.objects.create(
                user=request.user,
                name=recipe_data.get('title', ''),
                description=recipe_data.get('description', '')
            )
            
            # Create ingredients
            for ingredient in recipe_data.get('ingredients', []):
                Ingredient.objects.create(
                    recipe=recipe,
                    name=ingredient,
                    quantity=0,
                    unit=''
                )
            
            # Create steps
            for i, instruction in enumerate(recipe_data.get('instructions_list', []), 1):
                Step.objects.create(
                    recipe=recipe,
                    description=instruction,
                    order=i
                )
            
            # Create nutrients
            for macro, mass in recipe_data.get('nutrients', {}).items():
                Nutrient.objects.create(
                    recipe=recipe,
                    macro=macro,
                    mass=float(mass.split()[0]) if mass and mass.split() else 0
                )
            
        elif recipe_source == 'file':
            file = request.FILES.get('file')
            if not file:
                return Response({'error': 'File required for file source'}, status=400)
            recipe_data = recipe_from_file(file)
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

        return Response({'id': recipe.id, 'name': recipe.name}, status=201)

@extend_schema(
    methods=['GET'],
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
@authentication_classes([TokenAuthentication])
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
            'ingredients': [
                {'name': i.name, 'quantity': i.quantity, 'unit': i.unit}
                for i in recipe.ingredients.all()
            ],
            'steps': [
                {'description': s.description}
                for s in recipe.steps.all().order_by('order')
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
        return Response({'message': f'Recipe {recipe_id} deleted'})

