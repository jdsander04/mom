from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Recipe

def process_recipe_data(data) -> Recipe:
    # Process recipe data here
    recipe: Recipe
    return recipe

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
                'name': {'type': 'string', 'description': 'Recipe name'},
                'description': {'type': 'string', 'description': 'Recipe description'},
                'ingredients': {
                    'type': 'array',
                    'description': 'Variable number of ingredients, each with name, quantity, unit',
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
                    'description': 'Variable number of steps, each with description',
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
    responses={201: {'description': 'Recipe created successfully'}}
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
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
            pass
        elif recipe_source == 'file':
            pass
        elif recipe_source == 'explicit':
            pass
        else:
            return Response({'error': 'Expected "url", "file", or '}, status=400)

        return Response({'id': recipe.id, 'name': recipe.name}, status=201)

@extend_schema(
    methods=['GET'], #parameters: recipe id
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'recipe_id': {
                    'type': 'integer',
                    'description': 'Recipe ID'
                }
            },
            'required': ['recipe_id']
        },
    },
    responses={200: {'description': 'Recipe details'}}
)
@extend_schema(
    methods=['PATCH'], #parameters: recipe id
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'recipe_id': {
                    'type': 'integer',
                    'description': 'Recipe ID'
                },
                'name': {'type': 'string', 'description': 'Recipe name'},
                'description': {'type': 'string', 'description': 'Recipe description'},
                'ingredients': {
                    'type': 'array',
                    'description': 'Variable number of ingredients, each with name, quantity, unit',
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
                    'description': 'Variable number of steps, each with description',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'description': {'type': 'string'}
                        }
                    }
                }
            },
            'required': ['recipe_id']
        },
    },
    responses={200: {'description': 'Recipe updated successfully'}}
)
@extend_schema(
    methods=['DELETE'], #parameters: recipe id
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'recipe_id': {
                    'type': 'integer',
                    'description': 'Recipe ID'
                }
            },
            'required': ['recipe_id']
        },
    },
    responses={200: {'description': 'Recipe deleted successfully'}}
)
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def recipe_detail(request, recipe_id):
    try:
        recipe = Recipe.objects.get(id=recipe_id, user=request.user)
    except Recipe.DoesNotExist:
        return Response({'error': 'Recipe not found'}, status=404)
    

    # Get specific recipe info
    if request.method == 'GET':
        return Response({'recipe_id': recipe.id, 'name': recipe.name, 'description': recipe.description})
    
    # Update existing recipe
    elif request.method == 'PATCH':
        return Response({'message': f'Recipe {recipe_id} edited'})
    
    # Delete specific recipe
    elif request.method == 'DELETE':
        return Response({'message': f'Recipe {recipe_id} deleted'})

