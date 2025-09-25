from django.http import JsonResponse

def recipe_list(request):
    recipe_ids = [1, 2, 3, 4, 5]
    return JsonResponse({'recipe_ids': recipe_ids})
