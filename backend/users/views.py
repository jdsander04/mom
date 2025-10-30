from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.http import FileResponse, Http404
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image
import os
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
        
        # Compress image
        image = Image.open(uploaded_file)
        image = image.convert('RGB')
        image.thumbnail((300, 300), Image.Resampling.LANCZOS)
        
        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=85, optimize=True)
        buffer.seek(0)
        
        compressed_file = ContentFile(buffer.getvalue(), name=f"{user.id}_profile.jpg")
        user.profile_image = compressed_file
        user.save(update_fields=['profile_image'])
        return Response({'url': user.profile_image_url}, status=status.HTTP_200_OK)


class ProfileImageFileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.profile_image:
            raise Http404()
        file = user.profile_image
        # Ensure we use the configured storage backend (MinIO or filesystem)
        # Access the storage from the file field, or fall back to default_storage
        storage = getattr(file, 'storage', default_storage)
        file_name = file.name
        try:
            # Open file from storage backend (works for both MinIO and filesystem)
            file_obj = storage.open(file_name, 'rb')
            response = FileResponse(file_obj, as_attachment=False)
            # Let browsers cache briefly; adjust as needed
            response['Cache-Control'] = 'private, max-age=60'
            return response
        except Exception as e:
            raise Http404() from e
