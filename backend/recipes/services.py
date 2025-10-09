from recipe_scrapers import scrape_me
import requests
from bs4 import BeautifulSoup
from jinja2 import Template
import easyllm
import json
import os

def _get_recipe_from_llm(text: str) -> dict:
    """Uses an LLM to extract structured recipe data from raw text."""
    template = Template("""
# System
You are a recipe extraction assistant. Extract recipe information from the provided text and respond in JSON format:
{
  "title": string,
  "description": string,
  "ingredients": [{"name": string, "quantity": number, "unit": string}],
  "instructions": [string]
}

# User
Extract recipe data from this text:
{{ text }}
    """)
    
    prompt = template.render(text=text)
    response = easyllm.ChatCompletion.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": prompt}]
    )
    
    try:
        return json.loads(response) if isinstance(response, str) else response
    except:
        return {"title": "", "description": "", "ingredients": [], "instructions": []}

def _get_text_from_website(url):
    """Fetches the raw text content from the given URL. readable by LLM."""
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    return soup.get_text(strip=True)

def recipe_from_url(url):
    try:
        scraper = scrape_me(url)
        return scraper.to_json()
    except Exception as e:
        text = _get_text_from_website(url)
        return _get_recipe_from_llm(text)

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
