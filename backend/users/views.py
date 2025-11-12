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
from core.media_utils import get_media_url
from core.error_handlers import (
    APIError, ErrorCodes, handle_file_upload_error, safe_api_call
)


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
            # Convert serializer errors to structured format
            field_errors = {}
            for field, messages in serializer.errors.items():
                field_errors[field] = [str(msg) for msg in messages]
            
            return APIError(
                error_code=ErrorCodes.VALIDATION_ERROR,
                message="Profile image validation failed",
                details="Please check the uploaded file and try again.",
                field_errors=field_errors
            ).to_response()

        uploaded_file = serializer.validated_data['file']
        
        try:
            # Validate file size (5MB limit)
            if uploaded_file.size > 5 * 1024 * 1024:
                return handle_file_upload_error(
                    'size', 
                    uploaded_file.name, 
                    max_size="5"
                ).to_response()
            
            # Compress image
            image = Image.open(uploaded_file)
            
            # Validate image format
            if image.format not in ['JPEG', 'PNG', 'GIF', 'WEBP']:
                return handle_file_upload_error(
                    'type',
                    uploaded_file.name,
                    allowed_types=['JPEG', 'PNG', 'GIF', 'WEBP']
                ).to_response()
            
            image = image.convert('RGB')
            image.thumbnail((300, 300), Image.Resampling.LANCZOS)
            
            buffer = BytesIO()
            image.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)
            
            compressed_file = ContentFile(buffer.getvalue(), name=f"{user.id}_profile.jpg")
            user.profile_image = compressed_file
            user.save(update_fields=['profile_image'])
            
            return Response({
                'url': user.profile_image_url,
                'message': 'Profile image updated successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return handle_file_upload_error('upload', uploaded_file.name).to_response()


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
