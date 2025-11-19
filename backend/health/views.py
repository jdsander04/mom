from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Allergy, Nutrient, Budget, UserNutritionSnapshot
from .serializers import AllergySerializer, NutrientSerializer, BudgetSerializer
from django.db import DatabaseError
from decimal import Decimal, InvalidOperation
from django.db import transaction


class HealthSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        allergies = Allergy.objects.filter(user=user)
        # Return available nutrients (admin-managed). Use all() so the frontend
        # shows the list of nutrients created via admin.
        nutrients = Nutrient.objects.all()
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
            'nutrients': NutrientSerializer(nutrients, many=True, context={'request': request}).data,
            'budget': budget_data,
        })


class NutritionTotalsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            totals = UserNutritionSnapshot.compute_for_user(user)
            # try saving a snapshot for history (non-fatal)
            try:
                UserNutritionSnapshot.objects.create(user=user, data=totals['totals'], total_calories=totals['calories'])
            except Exception:
                pass
            return Response(totals)
        except Exception as e:
            return Response({'detail': 'Failed to compute nutrition totals', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AllergyListCreateView(generics.ListCreateAPIView):
    serializer_class = AllergySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Allergy.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NutrientListCreateView(generics.ListCreateAPIView):
    serializer_class = NutrientSerializer
    # Allow any authenticated user to view the global nutrient list, but only
    # admin users may create new global nutrients via this API.
    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Nutrient.objects.all()

    def perform_create(self, serializer):
        serializer.save()


class BudgetRetrieveUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            try:
                budget, _ = Budget.objects.get_or_create(user=request.user)
                # Update spent with actual weekly spending from order history
                weekly_spent = Budget.get_weekly_spent(request.user)
                data = BudgetSerializer(budget).data
                data['spent'] = weekly_spent
                return Response(data)
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


class AddSpentView(APIView):
    """POST { amount: number } -> increment the user's Budget.spent by amount.

    This keeps a history-free running total of money spent that the frontend
    can increment after placing an order. If the Budget record does not exist,
    it will be created.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        amount = data.get('amount')
        if amount is None:
            return Response({'detail': 'Missing amount'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amt = Decimal(str(amount))
        except (InvalidOperation, ValueError, TypeError):
            return Response({'detail': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

        if amt < 0:
            return Response({'detail': 'Amount must be non-negative'}, status=status.HTTP_400_BAD_REQUEST)

        # Create or update the Budget record atomically
        try:
            with transaction.atomic():
                budget, _ = Budget.objects.select_for_update().get_or_create(user=request.user)
                # budget.spent is DecimalField; ensure Decimal arithmetic
                current = budget.spent or Decimal('0')
                budget.spent = current + amt
                budget.save()
        except Exception as e:
            return Response({'detail': 'Failed to update budget', 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(BudgetSerializer(budget).data)
