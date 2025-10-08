from recipe_scrapers import scrape_me

def recipe_from_url(url, user):
    try:
        scraper = scrape_me(url)
        return scraper.to_json()
    except Exception as e:
        # pass to llm to get structured data
        pass

def recipe_from_file(file, user):
    pass
