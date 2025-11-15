from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from core.authentication import BearerTokenAuthentication
from rest_framework.response import Response
from core.error_handlers import (
    APIError, ErrorCodes, handle_not_found_error, handle_permission_denied_error,
    handle_file_upload_error, safe_api_call
)
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from .models import Recipe, Ingredient, Step, Nutrient, TrendingRecipe
from .services import recipe_from_url, normalize_spoonacular_recipe_data
from .tasks import process_llm_recipe_extraction, process_ocr_recipe_extraction
from .services import parse_ingredient_string, parse_serves_value
from core.media_utils import get_storage_url, get_media_url
import logging
import uuid
from django.core.files.storage import default_storage
from PIL import Image
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)


def normalize_recipe_response(recipe_data):
    """
    Normalize image_url in recipe response data to use Django media URLs.
    """
    if isinstance(recipe_data, dict):
        if 'image_url' in recipe_data and recipe_data['image_url']:
            recipe_data['image_url'] = get_media_url(recipe_data['image_url'])
    return recipe_data


def _safe_float(value, default=0.0):
    try:
        if value is None or value == '':
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _safe_int(value, default=0):
    try:
        if value is None or value == '':
            return int(default)
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def _safe_decimal(value):
    try:
        if value is None or value == '':
            return Decimal('0')
        rounded = round(float(value), 3)
        return Decimal(str(rounded))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal('0')


def _recipe_to_dict(recipe: Recipe, include_related=True) -> dict:
    """Convert a Recipe model instance to a dictionary for API responses."""
    data = {
        'id': recipe.id,
        'name': recipe.name,
        'description': recipe.description,
        'image_url': get_media_url(recipe.image_url),
        'source_url': recipe.source_url,
        'date_added': recipe.date_added.isoformat() if recipe.date_added else None,
        'serves': recipe.serves,
        'times_made': recipe.times_made,
        'favorite': recipe.favorite,
        'user_id': recipe.user.id,
        'is_trending': recipe.is_trending,
    }
    
    if include_related:
        data['ingredients'] = [
            {
                'name': i.name, 
                'quantity': float(i.quantity), 
                'unit': i.unit, 
                'original_text': getattr(i, 'original_text', '')
            }
            for i in recipe.ingredients.all()
        ]
        data['steps'] = [
            {'description': s.description, 'order': s.order}
            for s in recipe.steps.all().order_by('order')
        ]
        data['nutrients'] = [
            {'macro': n.macro, 'mass': float(n.mass)}
            for n in recipe.nutrients.all()
        ]
    
    return data


def _get_normalized_trending_recipe(trending_recipe: TrendingRecipe) -> dict:
    recipe_data = trending_recipe.recipe_data or {}
    normalized = recipe_data.get('normalized_recipe')
    if not normalized:
        normalized = normalize_spoonacular_recipe_data(recipe_data)
    return normalized


def _format_trending_ingredients(ingredients):
    formatted = []
    if not ingredients:
        return formatted
    for ingredient in ingredients:
        if not isinstance(ingredient, dict):
            continue
        name = str(ingredient.get('name') or '').strip()
        if not name:
            continue
        quantity = _safe_float(ingredient.get('quantity'), 0.0)
        unit = str(ingredient.get('unit') or '').strip()
        formatted.append({
            'name': name[:500],
            'quantity': quantity,
            'unit': unit[:100],
        })
    return formatted


def _format_trending_steps(steps):
    formatted = []
    if not steps:
        return formatted
    sorted_steps = sorted(
        (step for step in steps if isinstance(step, dict)),
        key=lambda step: step.get('order') if isinstance(step.get('order'), int) else 10_000
    )
    for idx, step in enumerate(sorted_steps, start=1):
        description = str(step.get('description') or step.get('step') or '').strip()
        if not description:
            continue
        order = step.get('order')
        if not isinstance(order, int):
            order = idx
        formatted.append({
            'description': description[:1000],
            'order': order,
        })
    return formatted


def _format_trending_nutrients(nutrients):
    formatted = []
    if not nutrients:
        return formatted
    for nutrient in nutrients:
        if not isinstance(nutrient, dict):
            continue
        macro = str(nutrient.get('macro') or nutrient.get('name') or '').strip()
        if not macro:
            continue
        mass = _safe_float(nutrient.get('mass') or nutrient.get('amount'), 0.0)
        formatted.append({
            'macro': macro,
            'mass': mass,
        })
    return formatted


def _trending_recipe_to_payload(trending_recipe: TrendingRecipe) -> dict:
    normalized = _get_normalized_trending_recipe(trending_recipe)
    ingredients = _format_trending_ingredients(normalized.get('ingredients'))
    steps = _format_trending_steps(normalized.get('steps'))
    nutrients = _format_trending_nutrients(normalized.get('nutrients'))

    return {
        'id': -int(trending_recipe.spoonacular_id),
        'name': normalized.get('name') or trending_recipe.title,
        'description': normalized.get('description') or trending_recipe.description or '',
        'image_url': get_media_url(normalized.get('image_url') or trending_recipe.image_url),
        'source_url': normalized.get('source_url') or trending_recipe.source_url,
        'date_added': trending_recipe.created_at.isoformat() if trending_recipe.created_at else None,
        'serves': normalized.get('serves'),
        'times_made': _safe_int(normalized.get('times_made') or (trending_recipe.recipe_data or {}).get('aggregateLikes'), 0),
        'favorite': False,
        'user_id': None,
        'ingredients': ingredients,
        'steps': steps,
        'nutrients': nutrients,
        'ready_in_minutes': normalized.get('ready_in_minutes') or trending_recipe.ready_in_minutes,
        'is_trending': True,
    }


def _create_recipe_from_trending(trending_recipe: TrendingRecipe, user) -> Recipe:
    normalized = _get_normalized_trending_recipe(trending_recipe)
    ingredients = _format_trending_ingredients(normalized.get('ingredients'))
    steps = _format_trending_steps(normalized.get('steps'))
    nutrients = _format_trending_nutrients(normalized.get('nutrients'))

    serves_value = normalized.get('serves')
    serves = parse_serves_value(serves_value) if serves_value is not None else None

    new_recipe = Recipe.objects.create(
        user=user,
        name=(normalized.get('name') or trending_recipe.title or 'Untitled Recipe')[:255],
        description=normalized.get('description') or trending_recipe.description or '',
        image_url=normalized.get('image_url') or trending_recipe.image_url,
        source_url=normalized.get('source_url') or trending_recipe.source_url,
        serves=serves,
        times_made=0,
        favorite=False,
    )

    for ingredient in ingredients:
        Ingredient.objects.create(
            recipe=new_recipe,
            name=ingredient['name'],
            quantity=_safe_decimal(ingredient.get('quantity')),
            unit=ingredient['unit'],
        )

    for idx, step in enumerate(steps, start=1):
        Step.objects.create(
            recipe=new_recipe,
            description=step['description'],
            order=step.get('order') or idx,
        )

    for nutrient in nutrients:
        Nutrient.objects.create(
            recipe=new_recipe,
            macro=str(nutrient.get('macro') or '')[:100],
            mass=_safe_decimal(nutrient.get('mass')),
        )

    return new_recipe

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
                        'image_url': {'type': 'string', 'format': 'uri', 'example': '/media/uploads/images/1_437d4f2c.png', 'description': 'Optional image URL for the recipe'},
                        'serves': {'type': 'integer', 'example': 4},
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
                                    'description': {'type': 'string'},
                                    'order': {'type': 'integer', 'description': 'Optional step order (defaults to array index + 1)'}
                                }
                            }
                        }
                    },
                    'required': ['recipe_source']
                },
                {
                    'type': 'object',
                    'properties': {
                        'recipe_source': {'type': 'string', 'enum': ['file']},
                        'file': {'type': 'string', 'format': 'binary', 'description': 'Image file containing recipe'}
                    },
                    'required': ['recipe_source', 'file']
                }
            ]
        },
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'recipe_source': {'type': 'string', 'enum': ['file']},
                'file': {'type': 'string', 'format': 'binary', 'description': 'Image file containing recipe'}
            },
            'required': ['recipe_source', 'file']
        }
    },
    responses={
        201: {
            'description': 'Recipe created successfully (may be a placeholder if processing async)',
            'content': {
                'application/json': {
                    'example': {
                        'id': 1,
                        'name': 'Processing recipe from image...',
                        'description': 'Recipe OCR extraction in progress. Please wait.',
                        'image_url': '/media/recipe_images/1_abc123.png',
                        'status': 'processing',
                        'ingredients': [],
                        'steps': []
                    }
                }
            }
        }
    }
)
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def recipe_list(request):
    # Get list of all recipe IDs
    if request.method == 'GET':
        recipes = Recipe.objects.filter(user=request.user)
        recipe_data = [{'id': r.id, 'name': r.name, 'favorite': r.favorite} for r in recipes]
        return Response({'recipes': recipe_data})
    
    # Create new recipe
    elif request.method == 'POST':
        logger.info(f"RECIPE_POST: Starting recipe creation for user {request.user.id}")
        recipe_source = request.data.get('recipe_source')
        
        if not recipe_source:
            logger.warning(f"RECIPE_POST: Missing recipe_source parameter for user {request.user.id}")
            return APIError(
                error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
                message="Missing recipe_source parameter",
                details='Must specify one of: "url", "file", or "explicit"'
            ).to_response()

        if recipe_source == 'url':
            logger.info(f"RECIPE_POST: Processing URL source for user {request.user.id}")
            url = request.data.get('url', '').strip()
            if not url:
                logger.warning(f"RECIPE_POST: Missing URL parameter for user {request.user.id}")
                return APIError(
                    error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
                    message="Missing URL parameter",
                    details='When recipe_source is "url", you must provide a "url" field'
                ).to_response()
            
            # Basic URL validation
            from urllib.parse import urlparse
            try:
                parsed = urlparse(url)
                if not parsed.scheme in ['http', 'https'] or not parsed.netloc:
                    logger.warning(f"RECIPE_POST: Invalid URL format '{url}' for user {request.user.id}")
                    return APIError(
                        error_code=ErrorCodes.INVALID_RECIPE_URL,
                        message="Invalid URL format",
                        details=f'URL must start with http:// or https:// and include a domain. Received: {url}'
                    ).to_response()
            except Exception as e:
                logger.warning(f"RECIPE_POST: URL parse error '{url}' for user {request.user.id}: {e}")
                return APIError(
                    error_code=ErrorCodes.INVALID_RECIPE_URL,
                    message="Invalid URL format",
                    details=f'Could not parse the provided URL: {url}'
                ).to_response()
            
            logger.info(f"RECIPE_POST: Extracting recipe from URL: {url}")
            try:
                # Try to extract recipe with async mode enabled
                # If scraper works, recipe_data will be returned
                # If LLM fallback is needed, recipe_data will be None
                recipe_data = recipe_from_url(url, use_async=True)
                
                # If recipe_data is None, it means LLM fallback is needed - create placeholder and queue task
                if recipe_data is None:
                    logger.info(f"RECIPE_POST: Scraper unavailable, creating placeholder for async LLM processing")
                    # Create placeholder recipe
                    placeholder_recipe = Recipe.objects.create(
                        user=request.user,
                        name='Processing recipe...',
                        description='Recipe extraction in progress. Please wait.',
                        source_url=url
                    )
                    logger.info(f"RECIPE_POST: Created placeholder recipe {placeholder_recipe.id} for URL: {url}")
                    
                    # Queue the async task
                    async_result = process_llm_recipe_extraction.delay(
                        recipe_id=placeholder_recipe.id,
                        url=url,
                        user_id=request.user.id
                    )
                    try:
                        task_id = getattr(async_result, 'id', None)
                        logger.info(
                            f"RECIPE_POST: Queued LLM extraction task_id={task_id} placeholder_id={placeholder_recipe.id} for url={url}"
                        )
                    except Exception:
                        # Swallow logging errors, continue
                        pass
                    
                    # Return placeholder recipe immediately
                    created_recipe = {
                        'id': placeholder_recipe.id,
                        'name': placeholder_recipe.name,
                        'description': placeholder_recipe.description,
                        'image_url': get_media_url(placeholder_recipe.image_url),
                        'source_url': placeholder_recipe.source_url,
                        'serves': None,
                        'date_added': placeholder_recipe.date_added.isoformat(),
                        'times_made': placeholder_recipe.times_made,
                        'favorite': placeholder_recipe.favorite,
                        'user_id': placeholder_recipe.user.id,
                        'is_trending': placeholder_recipe.is_trending,
                        'ingredients': [],
                        'steps': [],
                        'nutrients': [],
                        'status': 'processing'
                    }
                    return Response(created_recipe, status=201)
                
                # If we have recipe_data, scraper worked - process normally
                logger.info(f"RECIPE_POST: Successfully extracted recipe from URL with scraper")
                if recipe_data:
                    logger.debug(f"RECIPE_POST: Recipe data keys: {list(recipe_data.keys())}")
                    logger.debug(f"RECIPE_POST: Title: {recipe_data.get('title')}")
                    logger.debug(f"RECIPE_POST: Ingredients count: {len(recipe_data.get('ingredients', []))}")
                    logger.debug(f"RECIPE_POST: Instructions count: {len(recipe_data.get('instructions_list', []))}")
                
                if not recipe_data:
                    logger.error(f"RECIPE_POST: No recipe data returned from URL extraction")
                    return APIError(
                        error_code=ErrorCodes.RECIPE_EXTRACTION_FAILED,
                        message="Failed to extract recipe from URL",
                        details=f'No recipe data could be extracted from {url}. The URL may not contain a valid recipe or the site may not be supported.'
                    ).to_response()
                # Make title validation less strict - allow empty title
                title = recipe_data.get('title') or recipe_data.get('name') or 'Untitled Recipe'
                logger.info(f"RECIPE_POST: Processing recipe with title: {title}")
            except Exception as e:
                logger.error(f"RECIPE_POST: Recipe extraction error: {e}")
                import traceback
                logger.error(f"RECIPE_POST: Traceback: {traceback.format_exc()}")
                return APIError(
                    error_code=ErrorCodes.RECIPE_EXTRACTION_FAILED,
                    message="Failed to process recipe URL",
                    details=f'An error occurred while processing the recipe from {url}. Please verify the URL is correct and try again.'
                ).to_response()
            
            # Try to compute serves from common fields like yields/servings
            serves = None
            for key in ['serves', 'servings', 'yields']:
                val = recipe_data.get(key)
                parsed = parse_serves_value(val)
                if parsed:
                    serves = parsed
                    break

            recipe = Recipe.objects.create(
                user=request.user,
                name=title,
                description=recipe_data.get('description', ''),
                image_url=recipe_data.get('image', ''),
                source_url=url,
                serves=serves
            )
            
            # Create ingredients - handle both string and dict formats
            ingredients_data = recipe_data.get('ingredients', [])
            for ingredient in ingredients_data:
                try:
                    if isinstance(ingredient, str):
                        # parse_ingredient_string returns a list of dicts
                        parsed_list = parse_ingredient_string(ingredient)
                        for parsed in parsed_list:
                            name = parsed.get('name', '')[:255]
                            quantity = float(parsed.get('quantity', 0))
                            unit = parsed.get('unit', '')[:50]
                            if name.strip():
                                Ingredient.objects.create(
                                    recipe=recipe,
                                    name=name.strip(),
                                    quantity=max(0, quantity),
                                    unit=unit.strip(),
                                    original_text=ingredient
                                )
                    else:
                        # Handle dict format
                        name = str(ingredient.get('name', ''))[:255]
                        quantity = float(ingredient.get('quantity', 0))
                        unit = str(ingredient.get('unit', ''))[:50]
                        if name.strip():
                            Ingredient.objects.create(
                                recipe=recipe,
                                name=name.strip(),
                                quantity=max(0, quantity),
                                unit=unit.strip(),
                                original_text=ingredient.get('original_text', '')
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
            logger.info(f"RECIPE_POST: Processing file upload for user {request.user.id}")
            file = request.FILES.get('file')
            if not file:
                logger.warning(f"RECIPE_POST: Missing file parameter for user {request.user.id}")
                return APIError(
                    error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
                    message="Missing file parameter",
                    details='When recipe_source is "file", you must provide a "file" field containing the image'
                ).to_response()
            
            logger.info(f"RECIPE_POST: Received file '{file.name}' ({file.size} bytes) for user {request.user.id}")
            
            # Validate that it's an image
            try:
                # Verify it's an image by trying to open it with PIL
                image = Image.open(file)
                image.verify()
                file.seek(0)  # Reset file pointer after verify
                logger.debug(f"RECIPE_POST: Image validation successful for '{file.name}'")
            except Exception as e:
                logger.warning(f"RECIPE_POST: Invalid image file '{file.name}' for user {request.user.id}: {e}")
                return handle_file_upload_error(
                    'type', 
                    file.name, 
                    allowed_types=['PNG', 'JPEG', 'GIF', 'WEBP', 'BMP']
                ).to_response()
            
            # Generate unique file name
            unique_id = str(uuid.uuid4())[:8]
            file_extension = file.name.split('.')[-1] if '.' in file.name else 'jpg'
            file_name = f"recipe_images/{request.user.id}_{unique_id}.{file_extension}"
            logger.debug(f"RECIPE_POST: Generated file path: {file_name}")
            
            # Save image to MinIO
            try:
                saved_path = default_storage.save(file_name, file)
                image_url = get_storage_url(saved_path)
                logger.info(f"RECIPE_POST: Saved image to storage: {saved_path} -> {image_url}")
            except Exception as e:
                logger.error(f"RECIPE_POST: Failed to save image to storage for user {request.user.id}: {e}")
                return handle_file_upload_error('upload', file.name).to_response()
            
            # Create placeholder recipe
            placeholder_recipe = Recipe.objects.create(
                user=request.user,
                name='Processing recipe from image...',
                description='Recipe OCR extraction in progress. Please wait.',
                image_url=image_url
            )
            logger.info(f"RECIPE_POST: Created placeholder recipe {placeholder_recipe.id}")
            
            # Queue the async OCR task
            async_result = process_ocr_recipe_extraction.delay(
                recipe_id=placeholder_recipe.id,
                image_path=saved_path,
                user_id=request.user.id
            )
            try:
                task_id = getattr(async_result, 'id', None)
                logger.info(
                    f"RECIPE_POST: Queued OCR extraction task_id={task_id} placeholder_id={placeholder_recipe.id} for user {request.user.id}"
                )
            except Exception as e:
                logger.warning(f"RECIPE_POST: Could not log task ID: {e}")
                pass
            
            # Return placeholder recipe immediately
            created_recipe = {
                'id': placeholder_recipe.id,
                'name': placeholder_recipe.name,
                'description': placeholder_recipe.description,
                'image_url': get_media_url(placeholder_recipe.image_url),
                'source_url': placeholder_recipe.source_url,
                'serves': None,
                'date_added': placeholder_recipe.date_added.isoformat(),
                'times_made': placeholder_recipe.times_made,
                'favorite': placeholder_recipe.favorite,
                'user_id': placeholder_recipe.user.id,
                'is_trending': placeholder_recipe.is_trending,
                'ingredients': [],
                'steps': [],
                'nutrients': [],
                'status': 'processing'
            }
            return Response(created_recipe, status=201)
            
        elif recipe_source == 'explicit':
            logger.info(f"RECIPE_POST: Processing explicit recipe for user {request.user.id}")
            recipe_name = request.data.get('name', '')
            if not recipe_name:
                logger.warning(f"RECIPE_POST: Missing name for explicit recipe, user {request.user.id}")
                return APIError(
                    error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
                    message="Missing recipe name",
                    details='When recipe_source is "explicit", you must provide a "name" field'
                ).to_response()
            
            # Get image_url from request if provided
            image_url = request.data.get('image_url', '')
            if image_url:
                logger.info(f"RECIPE_POST: Explicit recipe includes image_url: {image_url}")
            
            logger.info(f"RECIPE_POST: Creating explicit recipe '{recipe_name}' for user {request.user.id}")
            recipe = Recipe.objects.create(
                user=request.user,
                name=recipe_name,
                description=request.data.get('description', ''),
                image_url=image_url if image_url else None,
                serves=parse_serves_value(request.data.get('serves'))
            )
            
            ingredients_count = 0
            for ing_data in request.data.get('ingredients', []):
                Ingredient.objects.create(
                    recipe=recipe,
                    name=ing_data.get('name', ''),
                    quantity=ing_data.get('quantity', 0),
                    unit=ing_data.get('unit', '')
                )
                ingredients_count += 1
            
            steps_count = 0
            for i, step_data in enumerate(request.data.get('steps', []), 1):
                Step.objects.create(
                    recipe=recipe,
                    description=step_data.get('description', ''),
                    order=i
                )
                steps_count += 1
            
            logger.info(f"RECIPE_POST: Created explicit recipe {recipe.id} with {ingredients_count} ingredients and {steps_count} steps")
                
        else:
            logger.warning(f"RECIPE_POST: Invalid recipe_source '{recipe_source}' for user {request.user.id}")
            return APIError(
                error_code=ErrorCodes.INVALID_FIELD_VALUE,
                message="Invalid recipe_source",
                details=f'recipe_source must be one of: "url", "file", or "explicit". Received: "{recipe_source}"'
            ).to_response()

        # Return complete recipe data after creation
        created_recipe = {
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'image_url': get_media_url(recipe.image_url),
            'source_url': recipe.source_url,
            'date_added': recipe.date_added.isoformat(),
            'serves': recipe.serves,
            'times_made': recipe.times_made,
            'favorite': recipe.favorite,
            'user_id': recipe.user.id,
        'is_trending': recipe.is_trending,
            'ingredients': [
                {
                    'name': i.name, 
                    'quantity': float(i.quantity), 
                    'unit': i.unit, 
                    'original_text': getattr(i, 'original_text', '')
                }
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
        logger.info(f"RECIPE_POST: Successfully created recipe {recipe.id} '{recipe.name}' for user {request.user.id}")
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
                'serves': {'type': 'integer', 'description': 'Number of servings'},
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
@safe_api_call
def recipe_detail(request, recipe_id):
    try:
        # For GET, allow reading any recipe (for popular recipes from other users)
        # For PATCH/DELETE, only allow modifying own recipes
        recipe = Recipe.objects.get(id=recipe_id)
        
        # Check ownership for write operations
        # Trending recipes (is_trending=True) cannot be modified or deleted
        if request.method in ['PATCH', 'DELETE']:
            if recipe.is_trending:
                return handle_permission_denied_error(
                    'modify' if request.method == 'PATCH' else 'delete',
                    'recipe'
                ).to_response()
            if recipe.user != request.user:
                return handle_permission_denied_error(
                    'modify' if request.method == 'PATCH' else 'delete',
                    'recipe'
                ).to_response()
    except Recipe.DoesNotExist:
        # Handle negative IDs (trending recipes) - lookup by spoonacular_id
        if recipe_id < 0:
            lookup_id = abs(recipe_id)
            trending_recipe = TrendingRecipe.objects.filter(spoonacular_id=lookup_id).select_related('recipe').first()
            if trending_recipe and trending_recipe.recipe:
                recipe = trending_recipe.recipe
            else:
                return handle_not_found_error("Recipe", recipe_id).to_response()
        else:
            return handle_not_found_error("Recipe", recipe_id).to_response()
    

    # Get specific recipe info
    if request.method == 'GET':
        recipe_data = _recipe_to_dict(recipe, include_related=True)
        return Response(recipe_data)
    
    # Update existing recipe
    elif request.method == 'PATCH':
        # based on recipe id, update fields if provided
        name = request.data.get('name')
        description = request.data.get('description')
        ingredients = request.data.get('ingredients')
        steps = request.data.get('steps')
        favorite = request.data.get('favorite')
        serves = request.data.get('serves')

        if name:
            recipe.name = name
        if description:
            recipe.description = description
        if favorite is not None:
            try:
                recipe.favorite = bool(favorite)
            except Exception:
                pass
        if serves is not None:
            try:
                parsed = parse_serves_value(serves)
                if parsed:
                    recipe.serves = parsed
                else:
                    recipe.serves = None
            except Exception:
                pass
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

@extend_schema(
    methods=['POST'],
    operation_id='recipe_made',
    responses={
        200: {
            'description': 'Recipe times_made incremented successfully',
            'content': {
                'application/json': {
                    'example': {'message': 'Recipe made count updated', 'times_made': 3}
                }
            }
        }
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def recipe_made(request, recipe_id):
    """Increment the times_made counter for a recipe when it's used.
    
    Allows any authenticated user to mark any recipe as made (for popular recipes feature).
    """
    try:
        recipe = Recipe.objects.get(id=recipe_id)
    except Recipe.DoesNotExist:
        return handle_not_found_error("Recipe", recipe_id).to_response()
    
    recipe.times_made += 1
    recipe.save()
    
    return Response({
        'message': 'Recipe made count updated',
        'times_made': recipe.times_made
    })


@extend_schema(
    methods=['POST'],
    operation_id='recipe_copy',
    responses={
        201: {
            'description': 'Recipe copied successfully',
            'content': {
                'application/json': {
                    'example': {
                        'id': 2,
                        'name': 'Spaghetti Bolognese',
                        'description': 'Hearty meat sauce',
                        'message': 'Recipe copied to your library'
                    }
                }
            }
        }
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def recipe_copy(request, recipe_id):
    """Copy a recipe to the current user's library."""
    # Handle trending recipes (negative IDs) - lookup by spoonacular_id
    if recipe_id < 0:
        lookup_id = abs(recipe_id)
        trending_recipe = TrendingRecipe.objects.filter(spoonacular_id=lookup_id).select_related('recipe').first()
        if trending_recipe and trending_recipe.recipe:
            source_recipe = trending_recipe.recipe
        else:
            return handle_not_found_error("Recipe", recipe_id).to_response()
    else:
        try:
            source_recipe = Recipe.objects.get(id=recipe_id)
        except Recipe.DoesNotExist:
            return handle_not_found_error("Recipe", recipe_id).to_response()
    
    # Check if user already has this recipe (by name or same recipe)
    # This is optional - we could allow multiple copies if desired
    existing = Recipe.objects.filter(user=request.user, name=source_recipe.name).first()
    if existing:
        return Response({
            'id': existing.id,
            'name': existing.name,
            'message': 'This recipe is already in your library'
        }, status=200)
    
    # Create a copy of the recipe
    copied_recipe = Recipe.objects.create(
        user=request.user,
        name=source_recipe.name,
        description=source_recipe.description,
        image_url=source_recipe.image_url,
        source_url=source_recipe.source_url,
        serves=source_recipe.serves,
        favorite=False,  # Don't copy favorite status
        times_made=0,  # Reset times_made for the copy
        is_trending=False  # Copied recipes are not trending
    )
    
    # Copy ingredients
    for ingredient in source_recipe.ingredients.all():
        Ingredient.objects.create(
            recipe=copied_recipe,
            name=ingredient.name,
            quantity=ingredient.quantity,
            unit=ingredient.unit
        )
    
    # Copy steps
    for step in source_recipe.steps.all():
        Step.objects.create(
            recipe=copied_recipe,
            description=step.description,
            order=step.order
        )
    
    # Copy nutrients
    for nutrient in source_recipe.nutrients.all():
        Nutrient.objects.create(
            recipe=copied_recipe,
            macro=nutrient.macro,
            mass=nutrient.mass
        )
    
    logger.info(f"RECIPE_COPY: User {request.user.id} copied recipe {source_recipe.id} to {copied_recipe.id}")
    
    return Response({
        'id': copied_recipe.id,
        'name': copied_recipe.name,
        'message': 'Recipe added to your library'
    }, status=201)


@extend_schema(
    methods=['GET'],
    operation_id='recipe_search',
    parameters=[
        OpenApiParameter(
            name='q',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Search query for recipe name and description',
            required=True
        ),
        OpenApiParameter(
            name='limit',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Maximum number of results to return (default: 50)',
            required=False
        ),
        OpenApiParameter(
            name='fuzziness',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Fuzziness level: 0=exact, 1=word-based, 2=typo-tolerant (default: 2)',
            required=False
        )
    ],
    responses={
        200: {
            'description': 'Search results with relevance scores',
            'content': {
                'application/json': {
                    'example': {
                        'results': [
                            {
                                'id': 1,
                                'name': 'Chocolate Chip Cookies',
                                'description': 'Classic homemade cookies',
                                'image_url': 'https://example.com/image.jpg',
                                'times_made': 5,
                                'score': 0.95
                            }
                        ],
                        'total': 1,
                        'query': 'chocolate',
                        'fuzziness': 2
                    }
                }
            }
        }
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def recipe_search(request):
    """Enhanced fuzzy text search for recipes by name and description."""
    from django.db import models
    import re
    from difflib import SequenceMatcher
    
    def levenshtein_distance(s1, s2):
        """Calculate Levenshtein distance between two strings."""
        if len(s1) < len(s2):
            return levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def fuzzy_match_score(query_words, text_words, fuzziness):
        """Calculate fuzzy match score between query and text."""
        if fuzziness == 0:
            # Exact matching
            text_lower = ' '.join(text_words).lower()
            query_lower = ' '.join(query_words).lower()
            return 1.0 if query_lower in text_lower else 0.0
        
        elif fuzziness == 1:
            # Word-based matching
            matches = 0
            total_words = len(query_words)
            
            for query_word in query_words:
                for text_word in text_words:
                    if query_word.lower() in text_word.lower():
                        matches += 1
                        break
            
            return matches / total_words if total_words > 0 else 0.0
        
        elif fuzziness == 2:
            # Typo-tolerant matching with Levenshtein distance
            matches = 0
            total_words = len(query_words)
            
            for query_word in query_words:
                best_match = 0
                for text_word in text_words:
                    # Calculate similarity ratio
                    similarity = SequenceMatcher(None, query_word.lower(), text_word.lower()).ratio()
                    
                    # Also check Levenshtein distance for short words
                    if len(query_word) <= 10:
                        distance = levenshtein_distance(query_word.lower(), text_word.lower())
                        max_len = max(len(query_word), len(text_word))
                        levenshtein_similarity = 1 - (distance / max_len) if max_len > 0 else 0
                        similarity = max(similarity, levenshtein_similarity)
                    
                    best_match = max(best_match, similarity)
                
                # Consider it a match if similarity is above threshold
                if best_match >= 0.6:  # 60% similarity threshold
                    matches += best_match
            
            return matches / total_words if total_words > 0 else 0.0
        
        return 0.0
    
    query = request.GET.get('q', '').strip()
    limit = int(request.GET.get('limit', 50))
    fuzziness = int(request.GET.get('fuzziness', 2))
    
    if not query:
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing search query",
            details="The 'q' parameter is required to search for recipes."
        ).to_response()
    
    # Validate fuzziness level
    if fuzziness not in [0, 1, 2]:
        return APIError(
            error_code=ErrorCodes.INVALID_FIELD_VALUE,
            message="Invalid fuzziness level",
            details="Fuzziness must be 0 (exact), 1 (word-based), or 2 (typo-tolerant)."
        ).to_response()
    
    # Limit the number of results to prevent performance issues
    limit = min(limit, 100)
    
    # Get all user recipes for fuzzy matching
    all_recipes = Recipe.objects.filter(user=request.user)
    
    # Split query into words
    query_words = re.findall(r'\b\w+\b', query.lower())
    
    scored_recipes = []
    
    for recipe in all_recipes:
        # Combine name and description for searching
        searchable_text = f"{recipe.name} {recipe.description}"
        text_words = re.findall(r'\b\w+\b', searchable_text.lower())
        
        # Calculate fuzzy match score
        score = fuzzy_match_score(query_words, text_words, fuzziness)
        
        # Only include recipes with some match
        if score > 0:
            scored_recipes.append((recipe, score))
    
    # Sort by score (descending), then by times_made, then by date_added
    scored_recipes.sort(key=lambda x: (-x[1], -x[0].times_made, -x[0].date_added.timestamp()))
    
    # Take top results
    top_recipes = scored_recipes[:limit]
    
    results = []
    for recipe, score in top_recipes:
        results.append({
            'id': recipe.id,
            'name': recipe.name,
            'description': recipe.description,
            'image_url': get_media_url(recipe.image_url),
            'source_url': recipe.source_url,
            'date_added': recipe.date_added.isoformat(),
            'times_made': recipe.times_made,
            'favorite': recipe.favorite,
            'user_id': recipe.user.id,
        'is_trending': recipe.is_trending,
            'score': round(score, 3)  # Round to 3 decimal places
        })
    
    return Response({
        'results': results,
        'total': len(results),
        'query': query,
        'fuzziness': fuzziness
    })


@extend_schema(
    methods=['GET'],
    operation_id='recipe_popular',
    parameters=[
        OpenApiParameter(
            name='limit',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Maximum number of recipes to return (default: 10, max: 100)',
            required=False
        )
    ],
    responses={
        200: {
            'description': 'Globally popular recipes sorted by times_made',
            'content': {
                'application/json': {
                    'example': {
                        'results': [
                            {
                                'id': 1,
                                'name': 'Spaghetti Bolognese',
                                'description': 'Hearty meat sauce',
                                'image_url': 'https://example.com/spag.jpg',
                                'source_url': 'https://example.com/recipe',
                                'date_added': '2025-10-31T12:00:00Z',
                                'times_made': 42,
                                'serves': 4
                            }
                        ],
                        'total': 1
                    }
                }
            }
        }
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def recipe_popular(request):
    """Return globally popular recipes ordered by times_made (desc), then date_added (desc).
    Only returns recipes with unique source_urls, keeping the oldest recipe for each source_url.
    """
    from django.db.models import Min, Q
    
    try:
        limit = int(request.GET.get('limit', 10))
    except Exception:
        limit = 10
    limit = max(1, min(limit, 100))

    # Prefer trending recipes if available
    latest_trending = TrendingRecipe.objects.order_by('-week').first()
    if latest_trending:
        trending_recipes = TrendingRecipe.objects.filter(
            week=latest_trending.week
        ).select_related('recipe').order_by('position')[:limit]
        
        if trending_recipes.exists():
            results = [
                _recipe_to_dict(tr.recipe, include_related=False)
                for tr in trending_recipes
            ]
            return Response({'results': results, 'total': len(results)})

    # Fallback to legacy popularity algorithm
    oldest_per_source = Recipe.objects.filter(
        source_url__isnull=False
    ).exclude(
        source_url=''
    ).values('source_url').annotate(
        oldest_date=Min('date_added')
    )
    
    recipe_ids = []
    
    for item in oldest_per_source:
        oldest_recipe = Recipe.objects.filter(
            source_url=item['source_url'],
            date_added=item['oldest_date']
        ).order_by('id').first()
        
        if oldest_recipe:
            recipe_ids.append(oldest_recipe.id)
    
    if recipe_ids:
        q_objects = Q(id__in=recipe_ids) | Q(source_url__isnull=True) | Q(source_url='')
    else:
        q_objects = Q(source_url__isnull=True) | Q(source_url='')
    
    recipes = Recipe.objects.filter(q_objects).order_by('-times_made', '-date_added')[:limit]

    results = []
    for r in recipes:
        results.append({
            'id': r.id,
            'name': r.name,
            'description': r.description,
            'image_url': get_media_url(r.image_url),
            'source_url': r.source_url,
            'date_added': r.date_added.isoformat() if r.date_added else None,
            'times_made': r.times_made,
            'serves': r.serves,
            'user_id': r.user.id,
            'is_trending': r.is_trending,
        })

    return Response({'results': results, 'total': len(results)})


@extend_schema(
    methods=['GET'],
    operation_id='trending_recipes_list',
    summary='Get trending recipes',
    description='Get trending recipes for a specific week. If no week is provided, returns the most recent week.',
    parameters=[
        OpenApiParameter(
            name='week',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            description='Week in format YYYY-WW (e.g., "2025-01"). If not provided, returns most recent week.',
        ),
    ],
    responses={
        200: {
            'description': 'List of trending recipes for the specified week',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'week': {'type': 'string', 'example': '2025-01'},
                            'week_start_date': {'type': 'string', 'format': 'date', 'example': '2025-01-06'},
                            'recipes': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'id': {'type': 'integer'},
                                        'spoonacular_id': {'type': 'integer'},
                                        'title': {'type': 'string'},
                                        'description': {'type': 'string'},
                                        'image_url': {'type': 'string'},
                                        'source_url': {'type': 'string'},
                                        'ready_in_minutes': {'type': 'integer'},
                                        'servings': {'type': 'integer'},
                                        'position': {'type': 'integer'},
                                        'recipe_data': {'type': 'object'},
                                    }
                                }
                            },
                            'count': {'type': 'integer'},
                        }
                    }
                }
            }
        },
        404: {'description': 'No trending recipes found for the specified week'},
    }
)
@api_view(['GET'])
@permission_classes([AllowAny])
def trending_recipes_list(request):
    """
    Get trending recipes for a specific week.
    If no week is provided, returns the most recent week available.
    """
    from django.utils import timezone
    from datetime import timedelta
    
    week_param = request.query_params.get('week', None)
    
    if week_param:
        # Get recipes for specified week
        trending_recipes = TrendingRecipe.objects.filter(week=week_param).order_by('position')
        if not trending_recipes.exists():
            return Response(
                {'error': f'No trending recipes found for week {week_param}'},
                status=404
            )
        week_str = week_param
        # Get week_start_date from first recipe
        week_start_date = trending_recipes.first().week_start_date
    else:
        # Get most recent week
        most_recent = TrendingRecipe.objects.order_by('-week').first()
        if not most_recent:
            return Response(
                {'error': 'No trending recipes available'},
                status=404
            )
        week_str = most_recent.week
        week_start_date = most_recent.week_start_date
        trending_recipes = TrendingRecipe.objects.filter(week=week_str).order_by('position')
    
    # Format response - all trending recipes have Recipe records
    recipes_data = []
    for trending_recipe in trending_recipes.select_related('recipe'):
        r = trending_recipe.recipe
        recipe_dict = _recipe_to_dict(r, include_related=True)
        recipes_data.append({
            **recipe_dict,
            'spoonacular_id': trending_recipe.spoonacular_id,
            'ready_in_minutes': trending_recipe.ready_in_minutes,
            'position': trending_recipe.position,
            'recipe_data': trending_recipe.recipe_data,  # Full Spoonacular data for reference
            'created_at': trending_recipe.created_at.isoformat() if trending_recipe.created_at else None,
        })
    
    return Response({
        'week': week_str,
        'week_start_date': week_start_date.isoformat() if week_start_date else None,
        'recipes': recipes_data,
        'count': len(recipes_data),
    })


@extend_schema(
    methods=['GET'],
    operation_id='trending_recipes_weeks',
    summary='List available weeks with trending recipes',
    description='Get a list of all weeks that have trending recipes available.',
    responses={
        200: {
            'description': 'List of available weeks',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'weeks': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'week': {'type': 'string', 'example': '2025-01'},
                                        'week_start_date': {'type': 'string', 'format': 'date', 'example': '2025-01-06'},
                                        'recipe_count': {'type': 'integer', 'example': 10},
                                    }
                                }
                            },
                            'count': {'type': 'integer'},
                        }
                    }
                }
            }
        },
    }
)
@api_view(['GET'])
@permission_classes([AllowAny])
def trending_recipes_weeks(request):
    """
    Get a list of all weeks that have trending recipes available.
    """
    from django.db.models import Count
    
    # Get distinct weeks with recipe counts
    weeks_data = TrendingRecipe.objects.values('week', 'week_start_date').annotate(
        recipe_count=Count('id')
    ).order_by('-week')
    
    weeks_list = []
    for week_info in weeks_data:
        weeks_list.append({
            'week': week_info['week'],
            'week_start_date': week_info['week_start_date'].isoformat() if week_info['week_start_date'] else None,
            'recipe_count': week_info['recipe_count'],
        })
    
    return Response({
        'weeks': weeks_list,
        'count': len(weeks_list),
    })

