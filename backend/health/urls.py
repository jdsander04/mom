from django.urls import path
from .views import HealthSummaryView, AllergyListCreateView, NutrientListCreateView, BudgetRetrieveUpdateView

urlpatterns = [
    path('', HealthSummaryView.as_view(), name='health-summary'),
    path('allergies/', AllergyListCreateView.as_view(), name='allergies-list-create'),
    path('nutrients/', NutrientListCreateView.as_view(), name='nutrients-list-create'),
    path('budget/', BudgetRetrieveUpdateView.as_view(), name='budget-get-post'),
]
