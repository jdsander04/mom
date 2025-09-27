from django.http import JsonResponse

# General recipe endpoints
def recipe_list(request):
    # Get list of all recipe IDs
    if request.method == 'GET':
        recipe_ids = [1, 2, 3, 4, 5]
        return JsonResponse({'recipe_ids': recipe_ids})
    
    # Create new recipe
    elif request.method == 'POST':
        return JsonResponse({'message': 'Recipe created successfully!'}, status=201)
    
# Recipe endpoints which require a specific recipe ID
def recipe_detail(request, recipe_id):

    # Get specific recipe info
    if request.method == 'GET':
        return JsonResponse({'recipe_id': recipe_id, 'title': f'Recipe {recipe_id}'})
    
    # Update existing recipe
    elif request.method =='PATCH':
        return JsonResponse({'message': f'Recipe {recipe_id} edited'})
    
    # Delete specific recipe
    elif request.method == 'DELETE':
        return JsonResponse({'message': f'Recipe {recipe_id} deleted'})
    

