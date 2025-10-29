from rest_framework import serializers


class ProfileImageUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True, allow_empty_file=False)


