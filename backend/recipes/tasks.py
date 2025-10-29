from celery import shared_task
import logging
from django.contrib.auth.models import User
from .models import Recipe, Ingredient, Step, Nutrient
from .services import _get_recipe_from_llm, _get_text_from_website

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
        
        if not recipe_data:
            logger.error(f"LLM_TASK: LLM extraction returned None for recipe {recipe_id}")
            recipe.delete()
            logger.info(f"LLM_TASK: Deleted placeholder recipe {recipe_id} due to LLM failure")
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
        recipe.save()
        
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

