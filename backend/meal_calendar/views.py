from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from datetime import datetime
from .models import MealPlan
from .serializers import MealPlanSerializer

@extend_schema(
    methods=['GET'],
    responses={200: {'description': 'List of meal plans'}}
)
@extend_schema(
    methods=['DELETE'],
    responses={200: {'description': 'All meal plans deleted successfully'}}
)
@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def meal_plan_list(request):
    if request.method == 'GET':
        meal_plans = MealPlan.objects.filter(user=request.user)
        serializer = MealPlanSerializer(meal_plans, many=True)
        return Response({'meal_plans': serializer.data})
    elif request.method == 'DELETE':
        MealPlan.objects.filter(user=request.user).delete()
        return Response({'message': 'All meal plans deleted successfully'})

@extend_schema(
    methods=['GET'],
    responses={200: {'description': 'Meal plan details'}}
)
@extend_schema(
    methods=['POST'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'breakfast': {'type': 'array', 'description': 'Breakfast items'},
                'lunch': {'type': 'array', 'description': 'Lunch items'},
                'dinner': {'type': 'array', 'description': 'Dinner items'},
                'snacks': {'type': 'array', 'description': 'Snack items'}
            }
        }
    },
    responses={201: {'description': 'Meal plan created successfully'}}
)
@extend_schema(
    methods=['PATCH'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'breakfast': {'type': 'array', 'description': 'Breakfast items'},
                'lunch': {'type': 'array', 'description': 'Lunch items'},
                'dinner': {'type': 'array', 'description': 'Dinner items'},
                'snacks': {'type': 'array', 'description': 'Snack items'}
            }
        }
    },
    responses={200: {'description': 'Meal plan updated successfully'}}
)
@extend_schema(
    methods=['DELETE'],
    responses={200: {'description': 'Meal plan deleted successfully'}}
)
@api_view(['GET', 'POST', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@authentication_classes([TokenAuthentication])
def meal_plan_detail(request, date):
    if request.method == 'GET':
        try:
            meal_plan = MealPlan.objects.get(user=request.user, date=date)
            serializer = MealPlanSerializer(meal_plan)
            return Response(serializer.data)
        except MealPlan.DoesNotExist:
            return Response({'error': 'Meal plan not found'}, status=404)
    
    elif request.method == 'POST':
        meal_plan, created = MealPlan.objects.get_or_create(
            user=request.user, 
            date=datetime.strptime(date, '%Y-%m-%d').date(),
            defaults=request.data
        )
        if not created:
            for key, value in request.data.items():
                if hasattr(meal_plan, key):
                    setattr(meal_plan, key, value)
            meal_plan.save()
        
        serializer = MealPlanSerializer(meal_plan)
        return Response(serializer.data, status=201)
    
    elif request.method == 'PATCH':
        try:
            meal_plan = MealPlan.objects.get(user=request.user, date=date)
        except MealPlan.DoesNotExist:
            return Response({'error': 'Meal plan not found'}, status=404)
            
        serializer = MealPlanSerializer(meal_plan, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': f'Meal plan for {date} updated'})
        return Response({'error': 'Invalid data'}, status=400)
    
    elif request.method == 'DELETE':
        try:
            meal_plan = MealPlan.objects.get(user=request.user, date=date)
            meal_plan.delete()
            return Response({'message': f'Meal plan for {date} deleted'})
        except MealPlan.DoesNotExist:
            return Response({'error': 'Meal plan not found'}, status=404)