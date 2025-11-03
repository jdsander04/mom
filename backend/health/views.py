from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Allergy, Nutrient, Budget
from .serializers import AllergySerializer, NutrientSerializer, BudgetSerializer
from django.db import DatabaseError


class HealthSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        allergies = Allergy.objects.filter(user=user)
        nutrients = Nutrient.objects.filter(user=user)
        try:
            try:
                budget = Budget.objects.get(user=user)
                budget_data = BudgetSerializer(budget).data
            except Budget.DoesNotExist:
                budget_data = {'weekly_budget': 0, 'spent': 0}
        except DatabaseError:
            # Database isn't ready (migrations not applied) or other DB error.
            # Return a safe default and a 503 so callers know to retry later.
            return Response(
                {
                    'detail': 'Database not ready. Please run migrations.',
                    'allergies': [],
                    'nutrients': [],
                    'budget': {'weekly_budget': 0, 'spent': 0},
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({
            'allergies': AllergySerializer(allergies, many=True).data,
            'nutrients': NutrientSerializer(nutrients, many=True).data,
            'budget': budget_data,
        })


class AllergyListCreateView(generics.ListCreateAPIView):
    serializer_class = AllergySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Allergy.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NutrientListCreateView(generics.ListCreateAPIView):
    serializer_class = NutrientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Nutrient.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetRetrieveUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            try:
                budget = Budget.objects.get(user=request.user)
                return Response(BudgetSerializer(budget).data)
            except Budget.DoesNotExist:
                return Response({'weekly_budget': 0, 'spent': 0})
        except DatabaseError:
            return Response(
                {'detail': 'Database not ready. Please run migrations.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    def post(self, request):
        # create or update
        data = request.data
        try:
            budget, _ = Budget.objects.get_or_create(user=request.user)
        except DatabaseError:
            return Response(
                {'detail': 'Database not ready. Please run migrations.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = BudgetSerializer(budget, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
