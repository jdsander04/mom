"""
Utility functions for handling media URLs.
Converts S3/MinIO URLs to Django media proxy URLs.
"""
from django.conf import settings
from urllib.parse import urlparse, urlunparse
import re


def get_media_url(file_path_or_url):
    """
    Convert a file path or S3/MinIO URL to a Django media URL.
    Preserves external URLs (e.g., from recipe scrapers) unchanged.
    
    Args:
        file_path_or_url: Can be:
            - A relative path like 'recipe_images/file.jpg'
            - A full S3/MinIO URL like 'http://localhost:9000/media/recipe_images/file.jpg'
            - A full S3/MinIO URL like 'http://minio:9000/media/recipe_images/file.jpg'
            - An external URL like 'https://www.allrecipes.com/thmb/...' (preserved as-is)
    
    Returns:
        - Django media URL like '/media/recipe_images/file.jpg' for internal files
        - Original external URL for external URLs (unchanged)
    """
    if not file_path_or_url:
        return None
    
    # If it's already a Django media URL, return as-is
    if file_path_or_url.startswith('/media/'):
        return file_path_or_url
    
    # If it's a full URL (http:// or https://), check if it's from our MinIO/S3 storage
    if file_path_or_url.startswith('http://') or file_path_or_url.startswith('https://'):
        parsed = urlparse(file_path_or_url)
        hostname = parsed.hostname or ''
        path = parsed.path
        
        # Get MinIO endpoint configuration
        minio_enabled = getattr(settings, 'MINIO_ENABLED', False)
        minio_endpoint = getattr(settings, 'AWS_S3_ENDPOINT_URL', 'http://minio:9000')
        minio_parsed = urlparse(minio_endpoint)
        minio_hostname = minio_parsed.hostname or ''
        
        # Check if this URL is from our MinIO storage
        # Criteria: hostname matches MinIO endpoint OR path contains bucket name
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'media')
        is_minio_url = False
        
        if minio_enabled:
            # Check if hostname matches our MinIO endpoint
            # Handle various formats: localhost, minio, 127.0.0.1, etc.
            minio_hostnames = {
                minio_hostname,
                'localhost',
                '127.0.0.1',
                'minio',
                'django-backend',
                'backend'
            }
            
            if hostname in minio_hostnames:
                is_minio_url = True
            # Also check if path starts with bucket name (MinIO/S3 format)
            elif path.startswith(f'/{bucket_name}/') or path.startswith(f'/{bucket_name}'):
                is_minio_url = True
        
        # If it's NOT a MinIO URL, it's an external URL - return as-is
        if not is_minio_url:
            return file_path_or_url
        
        # It's a MinIO/S3 URL, extract the path and convert to Django media URL
        # Remove leading slash
        if path.startswith('/'):
            path = path[1:]
        
        # If path starts with bucket name (e.g., 'media/recipe_images/file.jpg'),
        # remove the bucket name prefix
        if path.startswith(f'{bucket_name}/'):
            path = path[len(bucket_name) + 1:]  # Remove 'media/' prefix
        elif path.startswith(f'/{bucket_name}/'):
            path = path[len(bucket_name) + 2:]  # Remove '/media/' prefix
        
        # Return Django media URL
        return f'/media/{path}'
    
    # If it's a relative path, just prepend /media/
    # Handle paths that might already start with media/
    if file_path_or_url.startswith('media/'):
        return f'/{file_path_or_url}'
    
    return f'/media/{file_path_or_url}'


def get_storage_url(file_path):
    """
    Get the media URL for a file stored in storage.
    This is a wrapper around storage.url() that converts S3 URLs to Django media URLs.
    
    Args:
        file_path: The path to the file in storage
    
    Returns:
        A Django media URL
    """
    from django.core.files.storage import default_storage
    
    # Get the URL from storage (might be S3 URL or local URL)
    storage_url = default_storage.url(file_path)
    
    # Convert to Django media URL if it's an S3/MinIO URL
    return get_media_url(storage_url)

