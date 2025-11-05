from rest_framework import serializers
from .models import Allergy, Nutrient, Budget, UserNutrient


class NutrientValueField(serializers.Field):
    def to_representation(self, obj):
        # obj is a Nutrient instance; we will look up UserNutrient for the
        # request user (if available) via serializer context.
        request = self.context.get('request') if hasattr(self, 'context') else None
        if not request or not request.user or not request.user.is_authenticated:
            return None
        try:
            un = UserNutrient.objects.get(user=request.user, nutrient=obj)
            # return as a float for frontend convenience; could also be string
            return float(un.value) if un.value is not None else None
        except UserNutrient.DoesNotExist:
            return None


class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = ('id', 'name', 'description')


class NutrientSerializer(serializers.ModelSerializer):
    # per-user value is computed from UserNutrient model when a user is present
    value = NutrientValueField(source='*', read_only=True)

    class Meta:
        model = Nutrient
        fields = ('id', 'name', 'description', 'value')


class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ('weekly_budget', 'spent')
