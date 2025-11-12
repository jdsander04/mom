from celery import shared_task
import logging
import base64
from datetime import timedelta
from django.core.files.storage import default_storage
from django.utils import timezone
from .models import Recipe, Ingredient, Step, Nutrient, TrendingRecipe
from .services import _get_recipe_from_llm, _get_text_from_website, parse_serves_value, _get_recipe_from_image
from .services import get_spoonacular_api_key, fetch_trending_recipes_from_spoonacular

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_llm_recipe_extraction(self, recipe_id, url, user_id):
    """
    Async task to extract recipe using LLM fallback and update placeholder recipe.
    On failure, deletes the placeholder recipe.
    
    Args:
        recipe_id: ID of the placeholder recipe to update
        url: URL to extract recipe from
        user_id: ID of the user who created the recipe
    
    Returns:
        dict: Updated recipe data or None if failed
    """
    try:
        logger.info(f"LLM_TASK: Starting LLM extraction for recipe {recipe_id} from URL: {url}")
        
        # Get the placeholder recipe
        try:
            recipe = Recipe.objects.get(id=recipe_id, user_id=user_id)
        except Recipe.DoesNotExist:
            logger.error(f"LLM_TASK: Recipe {recipe_id} not found")
            return None
        
        # Fetch text from website
        logger.info(f"LLM_TASK: Fetching text from website...")
        text = _get_text_from_website(url)
        
        if not text or len(text.strip()) < 10:
            logger.error(f"LLM_TASK: Failed to fetch or text too short for recipe {recipe_id}")
            # Delete placeholder on failure
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to text extraction failure")
            return None
        
        logger.debug(f"LLM_TASK: Extracted text length: {len(text)}")
        
        # Get recipe data from LLM
        logger.info(f"LLM_TASK: Calling LLM extraction...")
        recipe_data = _get_recipe_from_llm(text)
        logger.info(
            "LLM_TASK: Extraction decision is_recipe=%s reason='%s'",
            isinstance(recipe_data, dict) and recipe_data.get('is_recipe'),
            isinstance(recipe_data, dict) and recipe_data.get('reason', '')
        )
        
        if not recipe_data:
            logger.error(f"LLM_TASK: LLM extraction returned None for recipe {recipe_id}")
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to LLM failure")
            return None
        
        # If LLM explicitly says it's not a recipe, delete placeholder and exit
        if isinstance(recipe_data, dict) and recipe_data.get('is_recipe') is False:
            reason = recipe_data.get('reason', '')
            logger.warning(f"LLM_TASK: URL not a recipe for recipe {recipe_id}: {reason}")
            logger.info(f"LLM_TASK: Deleting placeholder {recipe_id} due to NOT A RECIPE (reason='{reason}') url={url}")
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to non-recipe content")
            return None
        
        # Check if we got meaningful data
        title = recipe_data.get('title') or recipe_data.get('name') or 'Untitled Recipe'
        has_content = (
            (recipe_data.get('ingredients') and len(recipe_data.get('ingredients', [])) > 0) or
            (recipe_data.get('instructions_list') and len(recipe_data.get('instructions_list', [])) > 0)
        )
        
        if not has_content:
            logger.error(f"LLM_TASK: LLM extraction returned empty content for recipe {recipe_id}")
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to empty content")
            return None
        
        # Update the placeholder recipe with real data
        logger.info(f"LLM_TASK: Updating recipe {recipe_id} with extracted data")
        recipe.name = title
        recipe.description = recipe_data.get('description', '')
        recipe.image_url = recipe_data.get('image', recipe.image_url or '')
        recipe.source_url = url
        # Set serves if we can infer it
        serves = None
        for key in ['serves', 'servings', 'yields']:
            val = recipe_data.get(key)
            parsed = parse_serves_value(val)
            if parsed:
                serves = parsed
                break
        recipe.serves = serves
        recipe.save()
        logger.info(
            "LLM_TASK: Saved base recipe %s (ingredients=%d, steps=%d will be created)",
            recipe.id,
            len(recipe_data.get('ingredients', []) or []),
            len((recipe_data.get('instructions_list') or []) if recipe_data.get('instructions_list') else ( [recipe_data.get('instructions')] if recipe_data.get('instructions') else []))
        )
        
        # Delete existing ingredients, steps, and nutrients
        recipe.ingredients.all().delete()
        recipe.steps.all().delete()
        recipe.nutrients.all().delete()
        
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
                logger.warning(f"LLM_TASK: Skipping invalid ingredient: {e}")
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
        
        logger.info(f"LLM_TASK: Successfully updated recipe {recipe_id}")
        return {
            'id': recipe.id,
            'name': recipe.name,
            'status': 'completed'
        }
        
    except Exception as e:
        logger.error(f"LLM_TASK: Error processing recipe {recipe_id}: {e}")
        import traceback
        logger.error(f"LLM_TASK: Traceback: {traceback.format_exc()}")
        
        # Delete placeholder recipe on failure
        try:
            recipe = Recipe.objects.get(id=recipe_id, user_id=user_id)
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to exception")
        except Recipe.DoesNotExist:
            pass
        
        # Retry up to max_retries times
        if self.request.retries < self.max_retries:
            logger.info(f"LLM_TASK: Retrying task for recipe {recipe_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
        
        return None


@shared_task(bind=True, max_retries=3)
def process_ocr_recipe_extraction(self, recipe_id, image_path, user_id):
    """
    Async task to extract recipe from uploaded image using OpenAI Vision.
    On failure, deletes the placeholder recipe.
    
    Args:
        recipe_id: ID of the placeholder recipe to update
        image_path: Path to the image in MinIO storage
        user_id: ID of the user who created the recipe
    
    Returns:
        dict: Updated recipe data or None if failed
    """
    try:
        logger.info(f"OCR_TASK: Starting OCR extraction for recipe {recipe_id} from image path: {image_path}")
        
        # Get the placeholder recipe
        try:
            recipe = Recipe.objects.get(id=recipe_id, user_id=user_id)
        except Recipe.DoesNotExist:
            logger.error(f"OCR_TASK: Recipe {recipe_id} not found")
            return None
        
        # Read image from storage and convert to base64
        logger.info(f"OCR_TASK: Reading image from storage...")
        try:
            file_obj = default_storage.open(image_path, 'rb')
            image_data = file_obj.read()
            file_obj.close()
            
            # Convert to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Determine image format from path
            image_format = image_path.split('.')[-1].lower() if '.' in image_path else 'png'
            logger.info(f"OCR_TASK: Converted image to base64, format: {image_format}")
        except Exception as e:
            logger.error(f"OCR_TASK: Failed to read image from storage: {e}")
            recipe.delete()
            logger.info(f"OCR_TASK: Deleted placeholder recipe {recipe_id} - storage error")
            return None
        
        # Extract recipe from image using OpenAI Vision
        logger.info(f"OCR_TASK: Extracting recipe from image using OpenAI Vision...")
        recipe_data = _get_recipe_from_image(image_base64, image_format)
        
        if not recipe_data:
            logger.error(f"OCR_TASK: Vision returned None for recipe {recipe_id}")
            recipe.delete()
            logger.info(f"OCR_TASK: Deleted placeholder recipe {recipe_id} - Vision failure")
            return None
        
        # If Vision explicitly says it's not a recipe, delete placeholder and exit
        if isinstance(recipe_data, dict) and recipe_data.get('is_recipe') is False:
            reason = recipe_data.get('reason', '')
            logger.warning(f"OCR_TASK: Image not a recipe for recipe {recipe_id}: {reason}")
            logger.info(f"OCR_TASK: Deleting placeholder {recipe_id} due to NOT A RECIPE (reason='{reason}')")
            recipe.delete()
            logger.info(f"OCR_TASK: Deleted placeholder recipe {recipe_id} due to non-recipe content")
            return None
        
        # Check if we got meaningful data
        title = recipe_data.get('title') or recipe_data.get('name') or 'Untitled Recipe'
        has_content = (
            (recipe_data.get('ingredients') and len(recipe_data.get('ingredients', [])) > 0) or
            (recipe_data.get('instructions_list') and len(recipe_data.get('instructions_list', [])) > 0)
        )
        
        if not has_content:
            logger.error(f"OCR_TASK: Vision returned empty content for recipe {recipe_id}")
            recipe.delete()
            logger.info(f"OCR_TASK: Deleted placeholder recipe {recipe_id} due to empty content")
            return None
        
        # Update the placeholder recipe with real data
        logger.info(f"OCR_TASK: Updating recipe {recipe_id} with extracted data")
        recipe.name = title
        recipe.description = recipe_data.get('description', '')
        # Keep the existing image_url from MinIO
        # Set serves if we can infer it
        serves = None
        for key in ['serves', 'servings', 'yields']:
            val = recipe_data.get(key)
            parsed = parse_serves_value(val)
            if parsed:
                serves = parsed
                break
        recipe.serves = serves
        recipe.save()
        logger.info(
            "OCR_TASK: Saved base recipe %s (ingredients=%d, steps=%d will be created)",
            recipe.id,
            len(recipe_data.get('ingredients', []) or []),
            len((recipe_data.get('instructions_list') or []) if recipe_data.get('instructions_list') else ( [recipe_data.get('instructions')] if recipe_data.get('instructions') else []))
        )
        
        # Delete existing ingredients, steps, and nutrients
        recipe.ingredients.all().delete()
        recipe.steps.all().delete()
        recipe.nutrients.all().delete()
        
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
                logger.warning(f"OCR_TASK: Skipping invalid ingredient: {e}")
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
        
        logger.info(f"OCR_TASK: Successfully updated recipe {recipe_id}")
        return {
            'id': recipe.id,
            'name': recipe.name,
            'status': 'completed'
        }
        
    except Exception as e:
        logger.error(f"OCR_TASK: Error processing recipe {recipe_id}: {e}")
        import traceback
        logger.error(f"OCR_TASK: Traceback: {traceback.format_exc()}")
        
        # Delete placeholder recipe on failure
        try:
            recipe = Recipe.objects.get(id=recipe_id, user_id=user_id)
            recipe.delete()
            logger.info(f"OCR_TASK: Deleted placeholder recipe {recipe_id} due to exception")
        except Recipe.DoesNotExist:
            pass
        
        # Retry up to max_retries times
        if self.request.retries < self.max_retries:
            logger.info(f"OCR_TASK: Retrying task for recipe {recipe_id} (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=60 * (self.request.retries + 1))
        
        return None


@shared_task(bind=True, max_retries=3)
def fetch_weekly_trending_recipes(self):
    """
    Celery task to fetch trending recipes from Spoonacular API.
    Runs every Friday at 11pm to get top 10 trending recipes for the past week.
    
    Stores recipes with week identifier (YYYY-WW format) for historical access.
    """
    try:
        logger.info("TRENDING_TASK: Starting weekly trending recipes fetch")
        
        # Get API key
        try:
            api_key = get_spoonacular_api_key()
        except ValueError as e:
            logger.error(f"TRENDING_TASK: {e}")
            return {'status': 'error', 'message': str(e)}
        
        # Calculate current week (ISO week format: YYYY-WW)
        now = timezone.now()
        # Get ISO week number and year
        year, week_num, _ = now.isocalendar()
        week_str = f"{year}-{week_num:02d}"
        
        # Calculate week start date (Monday of the week)
        days_since_monday = now.weekday()  # Monday is 0
        week_start = now.date() - timedelta(days=days_since_monday)
        
        logger.info(f"TRENDING_TASK: Fetching recipes for week {week_str} (start: {week_start})")
        
        # Check if we already have recipes for this week
        existing_count = TrendingRecipe.objects.filter(week=week_str).count()
        if existing_count > 0:
            logger.warning(f"TRENDING_TASK: Recipes for week {week_str} already exist ({existing_count} recipes). Skipping.")
            return {
                'status': 'skipped',
                'message': f'Recipes for week {week_str} already exist',
                'week': week_str,
                'count': existing_count
            }
        
        # Fetch recipes from Spoonacular
        try:
            recipes = fetch_trending_recipes_from_spoonacular(api_key, number=10)
        except Exception as e:
            logger.error(f"TRENDING_TASK: Failed to fetch from Spoonacular: {e}")
            raise
        
        if not recipes or len(recipes) == 0:
            logger.warning("TRENDING_TASK: No recipes returned from Spoonacular")
            return {'status': 'error', 'message': 'No recipes returned from Spoonacular'}
        
        # Store recipes in database
        created_count = 0
        for position, recipe_data in enumerate(recipes, 1):
            try:
                spoonacular_id = recipe_data.get('id')
                if not spoonacular_id:
                    logger.warning(f"TRENDING_TASK: Recipe at position {position} has no ID, skipping")
                    continue
                
                # Extract recipe information
                title = recipe_data.get('title', 'Untitled Recipe')
                description = recipe_data.get('summary', '')
                # Clean HTML from description
                if description:
                    import re
                    description = re.sub(r'<[^>]+>', '', description)
                
                image_url = recipe_data.get('image', '')
                source_url = recipe_data.get('sourceUrl', '')
                ready_in_minutes = recipe_data.get('readyInMinutes')
                servings = recipe_data.get('servings')
                
                # Create or update TrendingRecipe
                trending_recipe, created = TrendingRecipe.objects.update_or_create(
                    week=week_str,
                    position=position,
                    defaults={
                        'spoonacular_id': spoonacular_id,
                        'title': title[:500],  # Ensure it fits in CharField
                        'description': description,
                        'image_url': image_url,
                        'source_url': source_url,
                        'ready_in_minutes': ready_in_minutes,
                        'servings': servings,
                        'recipe_data': recipe_data,  # Store full data as JSON
                        'week_start_date': week_start,
                    }
                )
                
                if created:
                    created_count += 1
                    logger.info(f"TRENDING_TASK: Created trending recipe #{position}: {title}")
                else:
                    logger.info(f"TRENDING_TASK: Updated trending recipe #{position}: {title}")
                    
            except Exception as e:
                logger.error(f"TRENDING_TASK: Error saving recipe at position {position}: {e}")
                continue
        
        logger.info(f"TRENDING_TASK: Successfully stored {created_count} trending recipes for week {week_str}")
        return {
            'status': 'success',
            'week': week_str,
            'count': created_count,
            'week_start': week_start.isoformat()
        }
        
    except Exception as e:
        logger.error(f"TRENDING_TASK: Unexpected error: {e}", exc_info=True)
        
        # Retry up to max_retries times
        if self.request.retries < self.max_retries:
            logger.info(f"TRENDING_TASK: Retrying (attempt {self.request.retries + 1})")
            raise self.retry(exc=e, countdown=300)  # Retry after 5 minutes
        
        return {'status': 'error', 'message': str(e)}

