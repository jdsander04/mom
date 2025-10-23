from recipe_scrapers import scrape_me
import requests
from bs4 import BeautifulSoup
import json
import os
import logging
from dotenv import load_dotenv
from urllib.parse import urlparse

from openai import OpenAI

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s', datefmt='%d/%b/%Y %H:%M:%S')
logger = logging.getLogger(__name__)

load_dotenv()

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
        return {"title": "Recipe from URL", "description": "Processing...", "ingredients": [], "instructions_list": []}
    
    # Limit input text (no html.escape to preserve useful characters)
    sanitized_text = text[:5000]
    logger.debug(f"LLM: Text length: {len(sanitized_text)}")
    
    try:
        logger.debug("LLM: Getting OpenAI client...")
        client = _get_openai_client()
        
        if not client:
            logger.error("LLM: OpenAI client unavailable")
            return {"title": "Recipe from URL", "description": "OpenAI unavailable", "ingredients": [], "instructions_list": []}
        
        logger.info("LLM: Making API call to OpenAI...")
        logger.info('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" PENDING 0')
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a recipe extraction expert. Extract recipe information from text and return ONLY valid JSON."},
                {"role": "user", "content": f"Extract recipe from this text:\n\n{sanitized_text}\n\nReturn JSON with:\n- title: recipe name (string)\n- description: brief description (string)\n- ingredients: array of objects with name, quantity (number), unit (string)\n- instructions_list: array of step strings"}
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
        result.setdefault('title', 'Recipe from URL')
        result.setdefault('description', 'Extracted recipe')
        result.setdefault('ingredients', [])
        result.setdefault('instructions_list', [])
        
        # Convert string ingredients to proper format if needed
        if result['ingredients'] and isinstance(result['ingredients'][0], str):
            formatted_ingredients = []
            for ing in result['ingredients']:
                parts = str(ing).split()
                if len(parts) >= 3:
                    try:
                        qty = float(parts[0])
                        unit = parts[1]
                        name = ' '.join(parts[2:])
                        formatted_ingredients.append({"name": name, "quantity": qty, "unit": unit})
                    except ValueError:
                        formatted_ingredients.append({"name": str(ing), "quantity": 0, "unit": ""})
                else:
                    formatted_ingredients.append({"name": str(ing), "quantity": 0, "unit": ""})
            result['ingredients'] = formatted_ingredients
        
        logger.info(f"LLM: Final result with defaults: {result}")
        return result
    except Exception as e:
        logger.error(f"LLM extraction failed: {e}")
        logger.error('"POST https://api.openai.com/v1/chat/completions HTTP/1.1" 500 0')
        return {"title": "Recipe from URL", "description": "Could not extract recipe details", "ingredients": [], "instructions_list": []}



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

def recipe_from_url(url):
    """Extract recipe from URL using scraper first, then AI fallback."""
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
        result = json.loads(scraper.to_json())
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
    return {"title": "Recipe from URL", "description": "Recipe extraction failed", "ingredients": [], "instructions_list": []}

def recipe_from_file(file):
    pass

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
