Preferences API
===============

This app provides simple user preferences for diets and allergens and suggestion endpoints used by the frontend.

Endpoints (all under /api/ and require Token auth):

- GET /api/preferences/
  - Response: { diets: string[], allergens: string[] }

- PUT /api/preferences/
  - Request JSON: { diets: string[], allergens: string[] }
  - Response: { diets: string[], allergens: string[] }

- GET /api/preferences/diet_suggestions/?q=ve
  - Response: { suggestions: string[] }

- GET /api/preferences/ingredient_suggestions/?q=pe
  - Response: { suggestions: string[] }

Notes:
- The app uses a simple `Preference` model with JSON lists for `diets` and `allergens`.
- Run `python manage.py makemigrations preferences` and `python manage.py migrate` to create the DB table.
