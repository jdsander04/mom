from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .serializers import ProfileImageUploadSerializer


class ProfileImageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'url': user.profile_image_url
        })

    def put(self, request):
        return self._handle_upload(request)

    def patch(self, request):
        return self._handle_upload(request)

    def delete(self, request):
        user = request.user
        if user.profile_image:
            user.profile_image.delete(save=True)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _handle_upload(self, request):
        user = request.user
        serializer = ProfileImageUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data['file']
        user.profile_image = uploaded_file
        user.save(update_fields=['profile_image'])
        return Response({'url': user.profile_image_url}, status=status.HTTP_200_OK)
