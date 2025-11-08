from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from drf_spectacular.utils import extend_schema
from django.http import HttpResponse, Http404
from django.conf import settings
import boto3
from botocore.exceptions import ClientError
import logging
import os
import mimetypes

logger = logging.getLogger(__name__)

@extend_schema(
    methods=['POST'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'username': {'type': 'string'},
                'password': {'type': 'string', 'format': 'password'},
                'email': {'type': 'string', 'format': 'email'},
            },
            'required': ['username', 'password']
        }
    },
    responses={201: {'description': 'User created successfully'}, 400: {'description': 'Username already exists'}},
)
@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email')
    
    UserModel = get_user_model()
    if UserModel.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = UserModel.objects.create_user(username=username, password=password, email=email)
    token, created = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key, 
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined
        }
    }, status=status.HTTP_201_CREATED)

@extend_schema(
    methods=['POST'],
    request={
        'application/json': {
            'type': 'object',
            'properties': {
                'username': {'type': 'string'},
                'password': {'type': 'string', 'format': 'password'},
            },
            'required': ['username', 'password']
        }
    },
    responses={200: {'description': 'Token returned on valid credentials'}, 401: {'description': 'Invalid credentials'}},
)
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    user = authenticate(username=username, password=password)
    if user:
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key, 
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'date_joined': user.date_joined
            }
        })
    else:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@extend_schema(
    methods=['POST'],
    responses={200: {'description': 'Logged out successfully'}}
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    request.user.auth_token.delete()
    return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)

@extend_schema(
    methods=['DELETE'],
    responses={204: {'description': 'Account deleted successfully'}}
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    user = request.user
    user.delete()
    return Response({'message': 'Account deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


def media_proxy(request, path):
    """
    Proxy view to serve media files from MinIO bucket.
    Frontend requests to /media/<path> are proxied to MinIO at localhost:9000.
    """
    try:
        # Check if MinIO is enabled
        minio_enabled = getattr(settings, 'MINIO_ENABLED', False)
        
        if minio_enabled:
            # Fetch from MinIO using boto3
            s3_client = boto3.client(
                's3',
                endpoint_url=getattr(settings, 'AWS_S3_ENDPOINT_URL', 'http://minio:9000'),
                aws_access_key_id=getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
                aws_secret_access_key=getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1'),
                config=boto3.session.Config(signature_version=getattr(settings, 'AWS_S3_SIGNATURE_VERSION', 's3v4'))
            )
            
            bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'media')
            
            try:
                # Get object from MinIO
                response = s3_client.get_object(Bucket=bucket_name, Key=path)
                
                # Get content type
                content_type = response.get('ContentType')
                if not content_type:
                    content_type, _ = mimetypes.guess_type(path)
                    if not content_type:
                        content_type = 'application/octet-stream'
                
                # Read file content
                file_content = response['Body'].read()
                
                # Create HTTP response with appropriate headers
                http_response = HttpResponse(file_content, content_type=content_type)
                
                # Set cache headers
                http_response['Cache-Control'] = 'public, max-age=3600'
                
                return http_response
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                if error_code == 'NoSuchKey':
                    logger.warning(f"Media file not found in MinIO: {path}")
                    raise Http404(f"Media file not found: {path}")
                else:
                    logger.error(f"Error fetching media from MinIO: {e}")
                    raise Http404(f"Error fetching media file: {path}")
        else:
            # Fallback to local file system
            media_root = getattr(settings, 'MEDIA_ROOT', None)
            if not media_root:
                raise Http404("Media storage not configured")
            
            file_path = os.path.join(media_root, path)
            
            # Security check: ensure the file is within MEDIA_ROOT
            if not os.path.abspath(file_path).startswith(os.path.abspath(media_root)):
                raise Http404("Invalid media path")
            
            if not os.path.exists(file_path):
                raise Http404(f"Media file not found: {path}")
            
            # Read file and serve
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            content_type, _ = mimetypes.guess_type(file_path)
            if not content_type:
                content_type = 'application/octet-stream'
            
            http_response = HttpResponse(file_content, content_type=content_type)
            http_response['Cache-Control'] = 'public, max-age=3600'
            
            return http_response
            
    except Http404:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in media_proxy: {e}", exc_info=True)
        raise Http404(f"Error serving media file: {path}")
