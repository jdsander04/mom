from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from core.error_handlers import (
    APIError, ErrorCodes, handle_file_upload_error, safe_api_call
)
from drf_spectacular.utils import extend_schema
from django.http import HttpResponse, Http404
from django.conf import settings
from core.authentication import BearerTokenAuthentication
from core.media_utils import get_storage_url
from django.core.files.storage import default_storage
from PIL import Image
import boto3
from botocore.exceptions import ClientError
import logging
import os
import mimetypes
import uuid

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
@safe_api_call
def signup(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email = request.data.get('email')
    
    # Validate required fields
    if not username:
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing username",
            details="Username is required to create an account."
        ).to_response()
    
    if not password:
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing password",
            details="Password is required to create an account."
        ).to_response()
    
    # Validate username format
    if len(username) < 3:
        return APIError(
            error_code=ErrorCodes.INVALID_FIELD_VALUE,
            message="Username too short",
            details="Username must be at least 3 characters long."
        ).to_response()
    
    if len(username) > 150:
        return APIError(
            error_code=ErrorCodes.FIELD_TOO_LONG,
            message="Username too long",
            details="Username must be 150 characters or less."
        ).to_response()
    
    # Validate password strength
    if len(password) < 8:
        return APIError(
            error_code=ErrorCodes.INVALID_FIELD_VALUE,
            message="Password too weak",
            details="Password must be at least 8 characters long."
        ).to_response()
    
    UserModel = get_user_model()
    if UserModel.objects.filter(username=username).exists():
        return APIError(
            error_code=ErrorCodes.RESOURCE_ALREADY_EXISTS,
            message="Username already exists",
            details=f"The username '{username}' is already taken. Please choose a different username."
        ).to_response()
    
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
@safe_api_call
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    # Validate required fields
    if not username:
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing username",
            details="Username is required to log in."
        ).to_response()
    
    if not password:
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing password",
            details="Password is required to log in."
        ).to_response()
    
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
            },
            'message': f"Welcome back, {user.username}!"
        })
    else:
        return APIError(
            error_code=ErrorCodes.INVALID_CREDENTIALS,
            message="Invalid credentials",
            details="The username or password you entered is incorrect. Please check your credentials and try again."
        ).to_response()

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


@extend_schema(
    methods=['POST'],
    operation_id='media_upload_create',
    tags=['media'],
    summary='Upload an image file',
    description='Upload an image file and receive back just the image URL. This endpoint does NOT create any recipe or trigger recipe processing.',
    request={
        'multipart/form-data': {
            'type': 'object',
            'properties': {
                'file': {
                    'type': 'string',
                    'format': 'binary',
                    'description': 'Image file to upload (jpg, png, gif, webp, bmp). Maximum file size: 10MB.'
                }
            },
            'required': ['file']
        }
    },
    responses={
        200: {
            'description': 'Image uploaded successfully, URL returned',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'image_url': {
                                'type': 'string',
                                'format': 'uri',
                                'example': '/media/uploads/images/recipe_1234567890.jpg'
                            }
                        },
                        'required': ['image_url']
                    }
                }
            }
        },
        400: {
            'description': 'Bad request - invalid file',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'error': {
                                'type': 'string',
                                'example': 'Invalid file format'
                            },
                            'details': {
                                'type': 'string',
                                'example': 'The file is not a valid image. Please upload a PNG, JPEG, or other supported image format.'
                            }
                        }
                    }
                }
            }
        },
        401: {
            'description': 'Authentication required'
        },
        413: {
            'description': 'File too large',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'error': {
                                'type': 'string',
                                'example': 'File size exceeds limit'
                            },
                            'details': {
                                'type': 'string',
                                'example': 'Maximum file size is 10MB'
                            }
                        }
                    }
                }
            }
        },
        500: {
            'description': 'Internal server error',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'error': {
                                'type': 'string',
                                'example': 'Failed to upload image'
                            },
                            'details': {
                                'type': 'string',
                                'example': 'The image could not be saved to storage. Please try again.'
                            }
                        }
                    }
                }
            }
        }
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@authentication_classes([BearerTokenAuthentication])
@safe_api_call
def media_upload(request):
    """
    Upload an image file and return the image URL.
    This endpoint does NOT create any recipe or trigger recipe processing.
    """
    # Maximum file size: 10MB
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
    
    logger.info(f"MEDIA_UPLOAD: Starting image upload for user {request.user.id}")
    
    # Get the uploaded file
    file = request.FILES.get('file')
    if not file:
        logger.warning(f"MEDIA_UPLOAD: Missing file parameter for user {request.user.id}")
        return APIError(
            error_code=ErrorCodes.MISSING_REQUIRED_FIELD,
            message="Missing file parameter",
            details='You must provide a "file" field containing the image'
        ).to_response()
    
    logger.info(f"MEDIA_UPLOAD: Received file '{file.name}' ({file.size} bytes) for user {request.user.id}")
    
    # Validate file size
    if file.size > MAX_FILE_SIZE:
        logger.warning(f"MEDIA_UPLOAD: File too large ({file.size} bytes) for user {request.user.id}")
        return handle_file_upload_error(
            'size', 
            file.name, 
            max_size=f"{MAX_FILE_SIZE / (1024 * 1024):.0f}"
        ).to_response()
    
    # Validate that it's an image
    try:
        # Verify it's an image by trying to open it with PIL
        image = Image.open(file)
        image.verify()
        file.seek(0)  # Reset file pointer after verify
        
        # Check if it's a supported format
        if image.format not in ['JPEG', 'PNG', 'GIF', 'WEBP', 'BMP']:
            logger.warning(f"MEDIA_UPLOAD: Unsupported image format '{image.format}' for user {request.user.id}")
            return handle_file_upload_error(
                'type',
                file.name,
                allowed_types=['JPEG', 'PNG', 'GIF', 'WEBP', 'BMP']
            ).to_response()
        
        logger.debug(f"MEDIA_UPLOAD: Image validation successful for '{file.name}' (format: {image.format})")
    except Exception as e:
        logger.warning(f"MEDIA_UPLOAD: Invalid image file '{file.name}' for user {request.user.id}: {e}")
        return handle_file_upload_error(
            'type',
            file.name,
            allowed_types=['PNG', 'JPEG', 'GIF', 'WEBP', 'BMP']
        ).to_response()
    
    # Generate unique file name
    unique_id = str(uuid.uuid4())[:8]
    file_extension = file.name.split('.')[-1].lower() if '.' in file.name else 'jpg'
    # Use a generic uploads folder instead of recipe_images
    file_name = f"uploads/images/{request.user.id}_{unique_id}.{file_extension}"
    logger.debug(f"MEDIA_UPLOAD: Generated file path: {file_name}")
    
    # Save image to storage (MinIO or local filesystem)
    try:
        saved_path = default_storage.save(file_name, file)
        image_url = get_storage_url(saved_path)
        logger.info(f"MEDIA_UPLOAD: Saved image to storage: {saved_path} -> {image_url} for user {request.user.id}")
        
        return Response({
            'image_url': image_url
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"MEDIA_UPLOAD: Failed to save image to storage for user {request.user.id}: {e}", exc_info=True)
        return handle_file_upload_error('upload', file.name).to_response()
