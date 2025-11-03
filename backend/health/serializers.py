from rest_framework import serializers
from .models import Allergy, Nutrient, Budget


class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = ('id', 'name', 'description')


class NutrientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nutrient
        fields = ('id', 'name', 'description', 'value')


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ('weekly_budget', 'spent')
