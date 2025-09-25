from django.http import JsonResponse

def recipe_list(request):
    if request.method == 'GET':
        recipe_ids = [1, 2, 3, 4, 5]
        return JsonResponse({'recipe_ids': recipe_ids})
    elif request.method == 'POST':
        return JsonResponse({'message': 'Recipe created successfully!'}, status=201)

def recipe_detail(request, recipe_id):
    if request.method == 'GET':
        return JsonResponse({'recipe_id': recipe_id, 'title': f'Recipe {recipe_id}'})
    elif request.method == 'DELETE':
        return JsonResponse({'message': f'Recipe {recipe_id} deleted'})
