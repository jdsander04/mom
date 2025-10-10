Preferences API (CRUD)
======================

All endpoints are under /api/ and require Token authentication (Authorization: Token <token>).

1) Get full preferences

GET /api/preferences/
Response: { diets: Array, allergens: Array }

2) Replace full lists

PUT /api/preferences/
Body JSON: { diets: [...], allergens: [...] }
Response: { diets: [...], allergens: [...] }

3) Diets CRUD (frontend-friendly shape)

- Add diet (POST)
  POST /api/preferences/diets/
  Body: { id?: string, value: string }
  Response: { diets: [...] }

- Update diet (PATCH)
  PATCH /api/preferences/diets/<item_id>/
  Body: { value: string }
  Response: { diets: [...] }

- Delete diet (DELETE)
  DELETE /api/preferences/diets/<item_id>/delete/
  Response: { diets: [...] }

4) Allergens CRUD — identical shape under /api/preferences/allergens/

Notes on IDs and shapes:
- The endpoints accept preference lists stored as either simple string arrays (['Vegan']) or arrays of objects ([{id, value}]). The CRUD endpoints append dicts {id, value} when adding.
- If you use the frontend code which stores items as { id, value } objects, use those IDs when updating or deleting.

Run migrations:

Inside the backend container run:

python manage.py makemigrations
python manage.py migrate
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
