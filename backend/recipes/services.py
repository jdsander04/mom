from recipe_scrapers import scrape_me
import requests
from bs4 import BeautifulSoup
import json
import os
from dotenv import load_dotenv
from urllib.parse import urlparse
import html
from openai import OpenAI

load_dotenv()

def _get_openai_client():
    """Get OpenAI client with lazy initialization."""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment")
    return OpenAI(api_key=api_key)

def _get_recipe_from_llm(text: str) -> dict:
    """Uses OpenAI to extract structured recipe data from raw text."""
    print(f"LLM: Starting extraction with text length: {len(text) if text else 0}")
    
    if not text or len(text.strip()) < 10:
        print("LLM: Text too short, returning empty result")
        return {"title": "", "description": "", "ingredients": [], "instructions_list": []}
    
    # Sanitize and limit input text
    sanitized_text = html.escape(text[:5000])
    print(f"LLM: Sanitized text length: {len(sanitized_text)}")
    
    try:
        print("LLM: Getting OpenAI client...")
        client = _get_openai_client()
        
        print("LLM: Making API call to OpenAI...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Extract recipe information and respond with valid JSON only."},
                {"role": "user", "content": f"Extract recipe data from this text and return JSON with title, description, ingredients array (with name, quantity, unit), and instructions_list array: {sanitized_text}"}
            ],
            response_format={"type": "json_object"},
            max_tokens=1000,
            temperature=0
        )
        
        print("LLM: Received response from OpenAI")
        content = response.choices[0].message.content
        print(f"LLM: Raw response content: {content}")
        
        result = json.loads(content)
        print(f"LLM: Parsed JSON result: {result}")
        
        # Ensure required fields exist
        result.setdefault('title', '')
        result.setdefault('description', '')
        result.setdefault('ingredients', [])
        result.setdefault('instructions_list', [])
        
        print(f"LLM: Final result with defaults: {result}")
        return result
    except Exception as e:
        print(f"LLM extraction failed: {e}")
        import traceback
        print(f"LLM traceback: {traceback.format_exc()}")
        return {"title": "", "description": "", "ingredients": [], "instructions_list": []}

def _get_text_from_website(url):
    """Fetches the raw text content from the given URL. readable by LLM."""
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
        
        soup = BeautifulSoup(response.content, 'html.parser')
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        text = soup.get_text(strip=True)
        return text[:10000]  # Limit text length
    except Exception as e:
        print(f"Failed to fetch website content: {e}")
        return ""

def recipe_from_url(url):
    """Extract recipe from URL using scraper first, then AI fallback."""
    if not url:
        print("RECIPE_EXTRACT: No URL provided")
        return None
    
    print(f"RECIPE_EXTRACT: Attempting to extract recipe from: {url}")
    
    try:
        # Validate URL format
        parsed = urlparse(url)
        if not parsed.scheme in ['http', 'https'] or not parsed.netloc:
            raise ValueError("Invalid URL format")
        
        print("RECIPE_EXTRACT: Trying recipe scraper...")
        scraper = scrape_me(url)
        result = scraper.to_json()
        print(f"RECIPE_EXTRACT: Scraper result keys: {list(result.keys()) if result else 'None'}")
        print(f"RECIPE_EXTRACT: Scraper title: {result.get('title') if result else 'None'}")
        print(f"RECIPE_EXTRACT: Scraper ingredients count: {len(result.get('ingredients', [])) if result else 0}")
        
        # Check if scraper result is actually useful
        if result and result.get('title') and (result.get('ingredients') or result.get('instructions_list')):
            print(f"RECIPE_EXTRACT: Returning scraper result")
            return result
        else:
            print(f"RECIPE_EXTRACT: Scraper result incomplete, will try AI fallback")
    except Exception as e:
        print(f"RECIPE_EXTRACT: Recipe scraping failed: {e}")
        result = None
    
    # Fallback to AI extraction
    print("RECIPE_EXTRACT: Falling back to AI extraction...")
    try:
        text = _get_text_from_website(url)
        print(f"RECIPE_EXTRACT: Extracted text length: {len(text) if text else 0}")
        if text:
            ai_result = _get_recipe_from_llm(text)
            print(f"RECIPE_EXTRACT: AI result: {ai_result}")
            return ai_result
    except Exception as e:
        print(f"RECIPE_EXTRACT: AI fallback failed: {e}")
    
    print("RECIPE_EXTRACT: All extraction methods failed")
    return None

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
