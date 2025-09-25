from django.http import JsonResponse

def recipe_list(request):
    if request.method == 'GET':
        recipe_ids = [1, 2, 3, 4, 5]
        return JsonResponse({'recipe_ids': recipe_ids}, status=200)
    return JsonResponse({'error': 'Invalid request method'}, status=400)

def recipe_create(request):
    if request.method == 'POST':
        # Logic to create a new recipe would go here
        return JsonResponse({'message': 'Recipe created successfully!'}, status=201)
    return JsonResponse({'error': 'Invalid request method'}, status=400)


def recipe_delete(request, recipe_id):
    if request.method == 'DELETE':
        # Logic to delete the recipe with the given recipe_id would go here
        return JsonResponse({'message': f'Recipe {recipe_id} deleted successfully!'}, status=200)
    return JsonResponse({'error': 'Invalid request method'}, status=400)