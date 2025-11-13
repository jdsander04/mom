from recipe_scrapers import scrape_me
import requests
from bs4 import BeautifulSoup
import json
import os
import logging
from dotenv import load_dotenv
from urllib.parse import urlparse
import re

from openai import OpenAI
from ingredient_parser import parse_ingredient

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s', datefmt='%d/%b/%Y %H:%M:%S')
logger = logging.getLogger(__name__)

load_dotenv()


def _get_text_from_ocr(image_url: str) -> str:
    """Extract text from image using OCR service.
    
    This function tries multiple common OCR API formats:
    1. POST /ocr with JSON body
    2. POST / with JSON body
    3. Various response formats
    
    Returns combined text from all detected lines.
    """
    from django.conf import settings
    
    ocr_url = getattr(settings, 'OCR_SERVICE_URL', 'http://ocr:8000')
    
    # Try common OCR API endpoints
    endpoints_to_try = [
        f"{ocr_url}/ocr",
        f"{ocr_url}/",
        f"{ocr_url}/predict",
        f"{ocr_url}/extract",
    ]
    
    for api_url in endpoints_to_try:
        try:
            logger.info(f"OCR: Trying endpoint {api_url} for image: {image_url}")
            
            # Try different request formats
            response = requests.post(
                api_url,
                json={'image_url': image_url, 'image': image_url, 'url': image_url},
                timeout=30,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"OCR: Success with endpoint {api_url}")
                
                # Handle various response formats
                text_lines = []
                
                # Format 1: {"results": [{"text": "..."}, ...]}
                if isinstance(result, dict) and 'results' in result:
                    text_lines = [item.get('text', '') for item in result['results'] if item.get('text')]
                
                # Format 2: {"text": "..."}
                elif isinstance(result, dict) and 'text' in result:
                    text_lines = [result['text']]
                
                # Format 3: {"predictions": [{"text": "..."}, ...]}
                elif isinstance(result, dict) and 'predictions' in result:
                    text_lines = [item.get('text', '') for item in result['predictions'] if item.get('text')]
                
                # Format 4: [{"text": "..."}, ...]
                elif isinstance(result, list):
                    text_lines = [item.get('text', '') for item in result if isinstance(item, dict) and item.get('text')]
                
                full_text = '\n'.join(text_lines).strip()
                if full_text:
                    logger.info(f"OCR: Extracted {len(text_lines)} lines of text")
                    return full_text
                else:
                    logger.warning(f"OCR: No text found in response from {api_url}")
            else:
                logger.warning(f"OCR: Endpoint {api_url} returned status {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            logger.warning(f"OCR: Failed to connect to {api_url}: {e}")
            continue
        except Exception as e:
            logger.warning(f"OCR: Error parsing response from {api_url}: {e}")
            continue
    
    logger.error(f"OCR: All endpoints failed for image: {image_url}")
    return ""


def _normalize_unicode_fractions(text: str) -> str:
    """Replace unicode vulgar fractions with ascii equivalents like 1/2.

    Also collapses multiple spaces and removes leading bullets.
    """
    if not text:
        return ""
    vulgar_map = {
        '¼': '1/4', '½': '1/2', '¾': '3/4',
        '⅐': '1/7', '⅑': '1/9', '⅒': '1/10',
        '⅓': '1/3', '⅔': '2/3',
        '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
        '⅙': '1/6', '⅚': '5/6',
        '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
    }
    for k, v in vulgar_map.items():
        text = text.replace(k, v)
    # Remove common bullet characters at the start
    text = re.sub(r'^[\s•\-\u2022\u2023\u25E6\u2043\u2219]+', '', text)
    # Collapse repeated spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_ingredient_string(ingredient_str: str) -> list:
    """Parse an ingredient string into list of {name, quantity, unit} dicts using ingredient-parser-nlp.
    
    Returns list of dicts with quantity as float, unit as string, name as string.
    If multiple ingredient names are detected (e.g., "butter or margarine"), returns separate entries.
    Fallbacks to quantity=0, unit="" if not detectable.
    """
    if not ingredient_str or not str(ingredient_str).strip():
        return [{"name": "", "quantity": 0.0, "unit": ""}]
    
    try:
        parsed = parse_ingredient(str(ingredient_str), separate_names=True)
        
        results = []
        # Handle multiple names (e.g., "butter or margarine")
        names = parsed.name if isinstance(parsed.name, list) else [parsed.name] if parsed.name else []
        
        for name_obj in names:
            name = name_obj.text if hasattr(name_obj, 'text') else str(name_obj)
            
            # Extract quantity and unit from amount
            quantity = 0.0
            unit = ""
            if parsed.amount:
                amount = parsed.amount[0] if isinstance(parsed.amount, list) else parsed.amount
                try:
                    if hasattr(amount.quantity, 'value'):
                        quantity = float(amount.quantity.value)
                    else:
                        quantity = float(amount.quantity)
                except (ValueError, TypeError, AttributeError):
                    quantity = 0.0
                try:
                    if hasattr(amount.unit, 'name'):
                        unit = amount.unit.name
                    elif amount.unit:
                        unit = str(amount.unit)
                except (AttributeError, TypeError):
                    unit = ""
            
            results.append({"name": name, "quantity": quantity, "unit": unit})
        
        return results if results else [{"name": "", "quantity": 0.0, "unit": ""}]
    except Exception as e:
        logger.warning(f"Failed to parse ingredient '{ingredient_str}': {e}")
        return [{"name": str(ingredient_str), "quantity": 0.0, "unit": ""}]

def parse_serves_value(value) -> int:
    """Parse a serves/servings/yields value into a positive integer if possible.

    Accepts numbers or strings like "4", "4 servings", "Serves 6", "1 serving".
    Returns int or None if not parseable or <= 0.
    """
    if value is None:
        return None
    try:
        n = int(value)
        return n if n > 0 else None
    except Exception:
        pass
    try:
        s = str(value)
        s = _normalize_unicode_fractions(s)
        m = re.search(r"(\d+)", s)
        if m:
            n = int(m.group(1))
            return n if n > 0 else None
    except Exception:
        return None
    return None


def _sanitize_html_summary(summary: str) -> str:
    """Remove HTML tags and extra whitespace from Spoonacular summaries."""
    if not summary:
        return ""
    try:
        # Remove HTML tags
        cleaned = re.sub(r'<[^>]+>', ' ', summary)
        # Collapse whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()
    except Exception:
        return summary or ""


_NUTRIENT_NAME_MAP = {
    'calories': 'calories',
    'energy': 'calories',
    'fat': 'fatContent',
    'total lipid (fat)': 'fatContent',
    'saturated fat': 'saturatedFatContent',
    'unsaturated fat': 'unsaturatedFatContent',
    'carbohydrates': 'carbohydrateContent',
    'net carbs': 'carbohydrateContent',
    'fiber': 'fiberContent',
    'sugar': 'sugarContent',
    'protein': 'proteinContent',
    'cholesterol': 'cholesterolContent',
    'sodium': 'sodiumContent',
}


def normalize_spoonacular_recipe_data(recipe: dict) -> dict:
    """Convert Spoonacular recipe payload into MOM recipe schema."""
    if not recipe:
        return {
            'name': '',
            'description': '',
            'image_url': '',
            'source_url': '',
            'serves': None,
            'ingredients': [],
            'steps': [],
            'nutrients': [],
            'times_made': 0,
            'ready_in_minutes': None,
        }

    def _get_float(value, default=0.0):
        try:
            if value is None or value == '':
                return float(default)
            return float(value)
        except (TypeError, ValueError):
            return float(default)

    def _get_int(value, default=0):
        try:
            if value is None or value == '':
                return int(default)
            return int(value)
        except (TypeError, ValueError):
            return int(default)

    title = recipe.get('title') or recipe.get('name') or 'Untitled Recipe'
    description = _sanitize_html_summary(recipe.get('summary') or recipe.get('instructions', ''))
    image_url = recipe.get('image') or recipe.get('imageUrl') or ''
    source_url = recipe.get('sourceUrl') or recipe.get('spoonacularSourceUrl') or ''
    serves = parse_serves_value(recipe.get('servings'))

    # Ingredients
    ingredients = []
    ingredient_sources = []
    if recipe.get('extendedIngredients'):
        ingredient_sources.append(recipe.get('extendedIngredients') or [])
    if recipe.get('usedIngredients'):
        ingredient_sources.append(recipe.get('usedIngredients') or [])
    if recipe.get('missedIngredients'):
        ingredient_sources.append(recipe.get('missedIngredients') or [])

    for ingredient_list in ingredient_sources:
        for ingredient in ingredient_list:
            name = (
                ingredient.get('nameClean')
                or ingredient.get('originalName')
                or ingredient.get('name')
                or ingredient.get('original')
                or ''
            ).strip()
            if not name:
                continue

            amount = ingredient.get('amount')
            if amount is None and isinstance(ingredient.get('measures'), dict):
                amount = (
                    ingredient['measures'].get('us', {}).get('amount')
                    or ingredient['measures'].get('metric', {}).get('amount')
                )

            unit = (
                ingredient.get('unit')
                or ingredient.get('unitShort')
                or ingredient.get('unitLong')
                or (
                    ingredient.get('measures', {}).get('us', {}).get('unitShort')
                    if isinstance(ingredient.get('measures'), dict)
                    else ''
                )
                or ''
            ).strip()

            ingredients.append({
                'name': name[:255],
                'quantity': round(_get_float(amount, 0.0), 3),
                'unit': unit[:50],
            })

    # Steps / Instructions
    steps = []
    analyzed = recipe.get('analyzedInstructions') or []
    for instruction in analyzed:
        steps_list = instruction.get('steps') or []
        for step in steps_list:
            description_text = (step.get('step') or '').strip()
            if not description_text:
                continue
            order = step.get('number')
            if order is None:
                order = len(steps) + 1
            steps.append({
                'description': description_text[:1000],
                'order': _get_int(order, len(steps) + 1),
            })

    if not steps:
        instructions_text = recipe.get('instructions')
        if instructions_text:
            steps.append({
                'description': instructions_text.strip()[:1000],
                'order': 1,
            })

    # Nutrients
    nutrients = []
    nutrition_data = recipe.get('nutrition', {})
    for nutrient in nutrition_data.get('nutrients', []):
        if not isinstance(nutrient, dict):
            continue
        name = (nutrient.get('name') or '').lower()
        macro = _NUTRIENT_NAME_MAP.get(name)
        if not macro:
            continue
        amount = _get_float(nutrient.get('amount'), 0.0)

        # Avoid duplicate macro entries - keep the first non-zero
        if any(existing.get('macro') == macro for existing in nutrients):
            continue

        nutrients.append({
            'macro': macro,
            'mass': round(amount, 3),
        })

    return {
        'name': title.strip()[:255],
        'description': description,
        'image_url': image_url,
        'source_url': source_url,
        'serves': serves,
        'ingredients': ingredients,
        'steps': steps,
        'nutrients': nutrients,
        'times_made': _get_int(recipe.get('aggregateLikes') or recipe.get('likes'), 0),
        'ready_in_minutes': recipe.get('readyInMinutes') or recipe.get('cookingMinutes'),
    }

def _get_openai_client():
    """Get OpenAI client with lazy initialization."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    
    import subprocess
    import sys
    
    # Use subprocess to avoid proxy environment variable issues
    try:
        # Create a minimal OpenAI client without any environment interference
        from openai import OpenAI as OpenAIClient
        return OpenAIClient(api_key=api_key)
    except Exception as e:
        logger.error(f"OpenAI client initialization failed: {e}")
        # If OpenAI fails, return None to skip LLM processing
        return None

def _get_recipe_from_llm(text: str) -> dict:
    """Uses OpenAI to extract structured recipe data from raw text."""
    logger.info(f"LLM: Starting extraction with text length: {len(text) if text else 0}")
    # log OPENAI_API_KEY length for debugging
    logger.debug(f"LLM: OPENAI_API_KEY length: {len(os.getenv('OPENAI_API_KEY') or '')}")
    if not text or len(text.strip()) < 10:
        logger.warning("LLM: Text too short, returning placeholder")
        result = {"title": "Recipe from URL", "description": "Processing...", "ingredients": [], "instructions_list": [], "is_recipe": False, "reason": "Insufficient content for a recipe"}
        logger.info(f"LLM: Decision is_recipe={result['is_recipe']} reason='{result['reason']}'")
        return result
    
    # Limit input text (no html.escape to preserve useful characters)
    sanitized_text = text[:5000]
    logger.debug(f"LLM: Text length: {len(sanitized_text)}")
    
    try:
        logger.debug("LLM: Getting OpenAI client...")
        client = _get_openai_client()
        
        if not client:
            logger.error("LLM: OpenAI client unavailable")
            result = {"title": "Recipe from URL", "description": "OpenAI unavailable", "ingredients": [], "instructions_list": [], "is_recipe": False, "reason": "LLM unavailable"}
            logger.info(f"LLM: Decision is_recipe={result['is_recipe']} reason='{result['reason']}'")
            return result
        
        logger.info("LLM: Making API call to OpenAI...")
        logger.info('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" PENDING 0')
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a strict recipe extraction expert. Return ONLY valid JSON. If the text is not about a recipe, you MUST return {\\\"is_recipe\\\": false, \\\"reason\\\": \\\"brief reason\\\"}. If it is a recipe, return {\\\"is_recipe\\\": true, \\\"title\\\": string, \\\"description\\\": string, \\\"ingredients\\\": [{\\\"name\\\": string, \\\"quantity\\\": number, \\\"unit\\\": string}], \\\"instructions_list\\\": [string], \\\"serves\\\"?: number} and nothing else."},
                {"role": "system", "content": "If available infer servings as an integer in 'serves'; otherwise omit it."},
                {"role": "user", "content": f"Decide if this is a recipe and extract it if so. Text follows:\n\n{sanitized_text}"}
            ],
            max_tokens=1500,
            temperature=0,
            timeout=30
        )
        
        logger.info("LLM: Received response from OpenAI")
        content = response.choices[0].message.content.strip()
        logger.info(f'"POST https://api.openai.com/v1/chat/completions HTTP/1.1" 200 {len(content)}')
        logger.debug(f"LLM: Raw response content: {content}")
        
        # Handle markdown code blocks
        if content.startswith('```json'):
            content = content[7:-3].strip()
        elif content.startswith('```'):
            content = content[3:-3].strip()
        
        result = json.loads(content)
        logger.debug(f"LLM: Parsed JSON result: {result}")
        
        # Ensure required fields exist with meaningful defaults
        if not isinstance(result, dict):
            result = {"is_recipe": False, "reason": "Invalid JSON structure"}
        result.setdefault('is_recipe', True)
        logger.info(f"LLM: Decision is_recipe={result.get('is_recipe')} reason='{result.get('reason', '')}'")
        if result.get('is_recipe'):
            result.setdefault('title', 'Recipe from URL')
            result.setdefault('description', 'Extracted recipe')
            result.setdefault('ingredients', [])
            result.setdefault('instructions_list', [])
            logger.info(
                "LLM: Extracted counts title='%s' ingredients=%d steps=%d",
                result.get('title'),
                len(result.get('ingredients') or []),
                len(result.get('instructions_list') or [])
            )
        
        # Convert string ingredients to proper format if needed, with fraction handling
        if result['ingredients'] and isinstance(result['ingredients'][0], str):
            formatted_ingredients = []
            for ing in result['ingredients']:
                parsed_list = parse_ingredient_string(ing)
                for parsed in parsed_list:
                    if parsed["name"] or parsed["quantity"]:
                        formatted_ingredients.append(parsed)
            result['ingredients'] = formatted_ingredients

        # Normalize serves under various possible keys
        serves_candidates = [
            result.get('serves'),
            result.get('servings'),
            result.get('yields'),
        ]
        for candidate in serves_candidates:
            parsed_serves = parse_serves_value(candidate)
            if parsed_serves:
                result['serves'] = parsed_serves
                break
        
        logger.info(f"LLM: Final result with defaults: {result}")
        return result
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        logger.error('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" 500 0')
        result = {"title": "Recipe from URL", "description": "Could not extract recipe details", "ingredients": [], "instructions_list": [], "is_recipe": False, "reason": "LLM error"}
        logger.info(f"LLM: Decision is_recipe={result['is_recipe']} reason='{result['reason']}'")
        return result



def _get_recipe_from_image(image_base64: str, image_format: str = "png") -> dict:
    """Uses OpenAI Vision to extract structured recipe data from a base64-encoded image."""
    logger.info(f"OCR: Starting image extraction from base64 data")
    
    try:
        logger.debug("OCR: Getting OpenAI client...")
        client = _get_openai_client()
        
        if not client:
            logger.error("OCR: OpenAI client unavailable")
            result = {"is_recipe": False, "reason": "OpenAI unavailable"}
            return result
        
        logger.info("OCR: Making API call to OpenAI Vision...")
        logger.info('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" PENDING 0')
        
        # Prepare image data URL with base64
        image_data_url = f"data:image/{image_format};base64,{image_base64}"
        
        response = client.chat.completions.create(
            model="gpt-4o",  # Use gpt-4o for vision capabilities
            messages=[
                {"role": "system", "content": "You are a strict recipe extraction expert. Return ONLY valid JSON. If the image does not contain a recipe, you MUST return {\\\"is_recipe\\\": false, \\\"reason\\\": \\\"brief reason\\\"}. If it is a recipe, return {\\\"is_recipe\\\": true, \\\"title\\\": string, \\\"description\\\": string, \\\"ingredients\\\": [{\\\"name\\\": string, \\\"quantity\\\": number, \\\"unit\\\": string}], \\\"instructions_list\\\": [string], \\\"serves\\\"?: number} and nothing else."},
                {"role": "system", "content": "If available infer servings as an integer in 'serves'; otherwise omit it. Parse fractions accurately (1/2, 2/3, etc.) and handle mixed numbers (1 1/2)."},
                {"role": "user", "content": [
                    {"type": "text", "text": "Decide if this is a recipe and extract it if so."},
                    {"type": "image_url", "image_url": {"url": image_data_url}}
                ]}
            ],
            max_tokens=1500,
            temperature=0,
            timeout=60  # Longer timeout for image processing
        )
        
        logger.info("OCR: Received response from OpenAI")
        content = response.choices[0].message.content.strip()
        logger.info(f'"POST https://api.openai.com/v1/chat/completions HTTP/1.1" 200 {len(content)}')
        logger.debug(f"OCR: Raw response content: {content}")
        
        # Handle markdown code blocks
        if content.startswith('```json'):
            content = content[7:-3].strip()
        elif content.startswith('```'):
            content = content[3:-3].strip()
        
        result = json.loads(content)
        logger.debug(f"OCR: Parsed JSON result: {result}")
        
        # Ensure required fields exist with meaningful defaults
        if not isinstance(result, dict):
            result = {"is_recipe": False, "reason": "Invalid JSON structure"}
        
        result.setdefault('is_recipe', True)
        logger.info(f"OCR: Decision is_recipe={result.get('is_recipe')} reason='{result.get('reason', '')}'")
        
        if result.get('is_recipe'):
            result.setdefault('title', 'Recipe from Image')
            result.setdefault('description', 'Extracted recipe')
            result.setdefault('ingredients', [])
            result.setdefault('instructions_list', [])
            logger.info(
                "OCR: Extracted counts title='%s' ingredients=%d steps=%d",
                result.get('title'),
                len(result.get('ingredients') or []),
                len(result.get('instructions_list') or [])
            )
        
        # Convert string ingredients to proper format if needed
        if result['ingredients'] and isinstance(result['ingredients'][0], str):
            formatted_ingredients = []
            for ing in result['ingredients']:
                parsed_list = parse_ingredient_string(ing)
                for parsed in parsed_list:
                    if parsed["name"] or parsed["quantity"]:
                        formatted_ingredients.append(parsed)
            result['ingredients'] = formatted_ingredients
        
        # Normalize serves under various possible keys
        serves_candidates = [
            result.get('serves'),
            result.get('servings'),
            result.get('yields'),
        ]
        for candidate in serves_candidates:
            parsed_serves = parse_serves_value(candidate)
            if parsed_serves:
                result['serves'] = parsed_serves
                break
        
        logger.info(f"OCR: Final result with defaults: {result}")
        return result
        
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        logger.error('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" 500 0')
        result = {"is_recipe": False, "reason": "OCR error"}
        logger.info(f"OCR: Decision is_recipe={result['is_recipe']} reason='{result['reason']}'")
        return result


def _get_text_from_website(url):
    """Fetches clean recipe content from URL for LLM processing."""
    try:
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme in ['http', 'https'] or not parsed.netloc:
            raise ValueError("Invalid URL")
        
        response = requests.get(
            url, 
            timeout=10,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)'},
            allow_redirects=True
        )
        response.raise_for_status()
        
        # Log the request
        logger.info(f'"GET {url} HTTP/1.1" {response.status_code} {len(response.content)}')
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript', 'form']):
            element.decompose()
        
        # Try to find recipe-specific content first
        recipe_selectors = [
            '[itemtype*="Recipe"]',  # Schema.org Recipe
            '.recipe', '.recipe-card', '.recipe-content',
            'article', 'main', '.entry-content', '.post-content'
        ]
        
        recipe_content = None
        for selector in recipe_selectors:
            elements = soup.select(selector)
            if elements:
                recipe_content = elements[0]
                break
        
        # If no specific recipe content found, use body
        if not recipe_content:
            recipe_content = soup.find('body') or soup
        
        # Extract text with better formatting
        text_parts = []
        for element in recipe_content.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'div']):
            text = element.get_text(strip=True)
            if text and len(text) > 10:  # Skip very short text
                text_parts.append(text)
        
        # Join with newlines for better structure
        full_text = '\n'.join(text_parts)
        return full_text[:10000]  # Limit text length
        
    except Exception as e:
        logger.error(f"Failed to fetch website content: {e}")
        logger.error(f'"GET {url} HTTP/1.1" 500 0')
        return ""

def recipe_from_url(url, use_async=False):
    """
    Extract recipe from URL using scraper first, then AI fallback.
    
    Args:
        url: URL to extract recipe from
        use_async: If True and LLM fallback is needed, returns None to signal async processing
    
    Returns:
        dict: Recipe data if successful, None if async processing is needed, or error dict if failed
    """
    if not url:
        logger.warning("RECIPE_EXTRACT: No URL provided")
        return None
    
    logger.info(f"RECIPE_EXTRACT: Attempting to extract recipe from: {url}")
    
    try:
        # Validate URL format
        parsed = urlparse(url)
        if not parsed.scheme in ['http', 'https'] or not parsed.netloc:
            raise ValueError("Invalid URL format")
        
        logger.info("RECIPE_EXTRACT: Trying recipe scraper...")
        scraper = scrape_me(url)
        result = scraper.to_json()  # This already returns a dict, no need to json.loads()
        logger.debug(f"RECIPE_EXTRACT: Scraper result keys: {list(result.keys()) if result else 'None'}")
        logger.debug(f"RECIPE_EXTRACT: Scraper title: {result.get('title') if result else 'None'}")
        logger.debug(f"RECIPE_EXTRACT: Scraper ingredients count: {len(result.get('ingredients', [])) if result else 0}")
        
        # Check if scraper result is actually useful
        if result and result.get('title') and (result.get('ingredients') or result.get('instructions_list')):
            logger.info(f"RECIPE_EXTRACT: Returning scraper result")
            return result
        else:
            logger.warning(f"RECIPE_EXTRACT: Scraper result incomplete, will try AI fallback")
    except Exception as e:
        logger.error(f"RECIPE_EXTRACT: Recipe scraping failed: {e}")
        result = None
    
    # Fallback to AI extraction
    if use_async:
        # Signal that async processing is needed
        logger.info("RECIPE_EXTRACT: LLM fallback needed, returning None for async processing")
        return None
    
    logger.info("RECIPE_EXTRACT: Falling back to AI extraction...")
    try:
        text = _get_text_from_website(url)
        logger.debug(f"RECIPE_EXTRACT: Extracted text length: {len(text) if text else 0}")
        if text:
            ai_result = _get_recipe_from_llm(text)
            logger.debug(f"RECIPE_EXTRACT: AI result: {ai_result}")
            return ai_result
    except Exception as e:
        logger.error(f"RECIPE_EXTRACT: AI fallback failed: {e}")
    
    logger.error("RECIPE_EXTRACT: All extraction methods failed")
    result = {"title": "Recipe from URL", "description": "Recipe extraction failed", "ingredients": [], "instructions_list": [], "is_recipe": False, "reason": "No recipe detected"}
    logger.info(f"RECIPE_EXTRACT: Decision is_recipe={result['is_recipe']} reason='{result['reason']}'")
    return result

def recipe_from_file(file):
    pass

def get_spoonacular_api_key():
    """Get Spoonacular API key from environment."""
    api_key = os.getenv('SPOONACULAR_API_KEY')
    if not api_key:
        raise ValueError("SPOONACULAR_API_KEY not found in environment")
    return api_key

def get_recipe_instructions_from_spoonacular(api_key, recipe_id):
    """
    Fetch detailed instructions for a specific recipe from Spoonacular.
    
    Args:
        api_key: Spoonacular API key
        recipe_id: Recipe ID from Spoonacular
    
    Returns:
        List of instruction steps or None if not found
    """
    base_url = f"https://api.spoonacular.com/recipes/{recipe_id}/analyzedInstructions"
    
    params = {
        'apiKey': api_key,
        'stepBreakdown': True
    }
    
    try:
        response = requests.get(base_url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        if data and len(data) > 0:
            return data[0].get('steps', [])
        return None
    except Exception as e:
        logger.warning(f"Could not fetch instructions for recipe {recipe_id}: {e}")
        return None

def fetch_trending_recipes_from_spoonacular(api_key, number=10):
    """
    Fetch trending/popular recipes from Spoonacular API.
    
    Tries the random endpoint first, then falls back to complexSearch sorted by
    popularity if the random endpoint returns no recipes.
    
    Args:
        api_key: Spoonacular API key
        number: Number of recipes to retrieve (default: 10)
    
    Returns:
        List of recipe dictionaries with full details
    """
    random_url = "https://api.spoonacular.com/recipes/random"
    random_params = {
        'apiKey': api_key,
        'number': number,
        'tags': 'main course,dessert'  # Popular meal types
    }
    
    def ensure_instructions(recipes_list):
        """Populate analyzedInstructions if missing."""
        for recipe in recipes_list:
            recipe_id = recipe.get('id')
            if not recipe.get('analyzedInstructions') or len(recipe.get('analyzedInstructions', [])) == 0:
                if recipe_id:
                    logger.info(f"Fetching instructions for recipe {recipe_id}...")
                    steps = get_recipe_instructions_from_spoonacular(api_key, recipe_id)
                    if steps:
                        recipe['analyzedInstructions'] = [{'steps': steps}]
    
    try:
        logger.info(f"Fetching {number} trending recipes from Spoonacular (random endpoint)...")
        response = requests.get(random_url, params=random_params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        if isinstance(data, dict) and data.get('status') and data.get('status') != 'success':
            logger.warning(f"Spoonacular random endpoint status='{data.get('status')}' message='{data.get('message', '')}'")
        recipes = data.get('recipes') or []
        
        if recipes:
            ensure_instructions(recipes)
            for recipe in recipes:
                try:
                    recipe['normalized_recipe'] = normalize_spoonacular_recipe_data(recipe)
                except Exception as normalize_error:
                    logger.warning(f"Failed to normalize Spoonacular recipe {recipe.get('id')}: {normalize_error}")
                    recipe['normalized_recipe'] = normalize_spoonacular_recipe_data({})
            logger.info(f"Successfully retrieved {len(recipes)} recipes from Spoonacular (random endpoint)")
            return recipes
        
        logger.warning("Random endpoint returned 0 recipes; falling back to popularity search endpoint.")
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching recipes from Spoonacular random endpoint: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response body: {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while using Spoonacular random endpoint: {e}")
        raise
    
    # Fallback: use complexSearch sorted by popularity
    fallback_url = "https://api.spoonacular.com/recipes/complexSearch"
    fallback_params = {
        'apiKey': api_key,
        'number': number,
        'sort': 'popularity',
        'sortDirection': 'desc',
        'addRecipeInformation': True,
        'fillIngredients': True
    }
    
    try:
        logger.info(f"Fetching {number} trending recipes from Spoonacular (fallback popularity search)...")
        response = requests.get(fallback_url, params=fallback_params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        if isinstance(data, dict) and data.get('status') and data.get('status') != 'success':
            logger.warning(f"Spoonacular fallback endpoint status='{data.get('status')}' message='{data.get('message', '')}'")
        recipes = data.get('results') or []
        
        if recipes:
            ensure_instructions(recipes)
            for recipe in recipes:
                try:
                    recipe['normalized_recipe'] = normalize_spoonacular_recipe_data(recipe)
                except Exception as normalize_error:
                    logger.warning(f"Failed to normalize Spoonacular fallback recipe {recipe.get('id')}: {normalize_error}")
                    recipe['normalized_recipe'] = normalize_spoonacular_recipe_data({})
            logger.info(f"Successfully retrieved {len(recipes)} recipes from Spoonacular (fallback endpoint)")
        else:
            logger.warning("Fallback popularity search endpoint returned 0 recipes.")
        
        return recipes
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching recipes from Spoonacular fallback endpoint: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response body: {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error while using Spoonacular fallback endpoint: {e}")
        raise

if __name__ == "__main__":
    url = "https://www.allrecipes.com/recipe/279394/air-fryer-prosciutto-and-mozzarella-grilled-cheese/"
    recipe = recipe_from_url(url)
    print(json.dumps(recipe, indent=2))
    # output:
    #    {
    #   "author": "France C",
    #   "canonical_url": "https://www.allrecipes.com/recipe/279394/air-fryer-prosciutto-and-mozzarella-grilled-cheese/",
    #   "category": "Lunch",
    #   "cook_time": 10,
    #   "cuisine": "American,Italian,Fusion",
    #   "description": "Make a crispy, golden mozzarella and prosciutto grilled cheese sandwich in the air fryer in just 8 minutes!",
    #   "host": "allrecipes.com",
    #   "image": "https://www.allrecipes.com/thmb/ZhtFpBmudbTrKVTjQBIJOvLg1dM=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/279394-air-fryer-prosciutto-and-mozzarella-grilled-cheese-GOLDMAN-R311232-4x3-3495-2ffa3cf08e45407a8f981f2155b1191d.jpg",
    #   "ingredient_groups": [
    #     {
    #       "ingredients": [
    #         "2 tablespoons unsalted butter, softened",
    #         "2 slices sourdough bread",
    #         "2 ounces prosciutto",
    #         "3 ounces fresh mozzarella, cut into 1/4-inch slices"
    #       ],
    #       "purpose": null
    #     }
    #   ],
    #   "ingredients": [
    #     "2 tablespoons unsalted butter, softened",
    #     "2 slices sourdough bread",
    #     "2 ounces prosciutto",
    #     "3 ounces fresh mozzarella, cut into 1/4-inch slices"
    #   ],
    #   "instructions": "Preheat the oven to 360 degrees F (180 degrees C).\nButter one side of a slice of bread and place it on a plate, buttered side down. Evenly top with prosciutto and mozzarella slices. Butter the second slice of bread and place on top, keeping the buttered side facing out.\nPlace in the air fryer and cook until lightly browned and toasted, about 8 minutes.",
    #   "instructions_list": [
    #     "Preheat the oven to 360 degrees F (180 degrees C).",
    #     "Butter one side of a slice of bread and place it on a plate, buttered side down. Evenly top with prosciutto and mozzarella slices. Butter the second slice of bread and place on top, keeping the buttered side facing out.",
    #     "Place in the air fryer and cook until lightly browned and toasted, about 8 minutes."
    #   ],
    #   "language": "en",
    #   "nutrients": {
    #     "calories": "774 kcal",
    #     "carbohydrateContent": "31 g",
    #     "cholesterolContent": "165 mg",
    #     "fiberContent": "1 g",
    #     "proteinContent": "38 g",
    #     "saturatedFatContent": "30 g",
    #     "sodiumContent": "1952 mg",
    #     "sugarContent": "2 g",
    #     "fatContent": "55 g",
    #     "unsaturatedFatContent": "0 g"
    #   },
    #   "prep_time": 5,
    #   "ratings": 5.0,
    #   "ratings_count": 3,
    #   "site_name": "Allrecipes",
    #   "title": "Air Fryer Prosciutto and Mozzarella Grilled Cheese",
    #   "total_time": 15,
    #   "yields": "1 serving"
    # }
