"""
Centralized error handling utilities for robust API error responses.
"""
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError
from django.db import IntegrityError
import logging

logger = logging.getLogger(__name__)


class APIError:
    """Standard API error response structure."""
    
    def __init__(self, error_code, message, details=None, status_code=400, field_errors=None):
        self.error_code = error_code
        self.message = message
        self.details = details
        self.status_code = status_code
        self.field_errors = field_errors or {}
    
    def to_response(self):
        """Convert to DRF Response object."""
        response_data = {
            'error': self.error_code,
            'message': self.message
        }
        
        if self.details:
            response_data['details'] = self.details
            
        if self.field_errors:
            response_data['field_errors'] = self.field_errors
            
        return Response(response_data, status=self.status_code)


class ErrorCodes:
    """Standardized error codes for consistent client handling."""
    
    # Authentication & Authorization
    AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED'
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
    PERMISSION_DENIED = 'PERMISSION_DENIED'
    TOKEN_EXPIRED = 'TOKEN_EXPIRED'
    
    # Validation Errors
    VALIDATION_ERROR = 'VALIDATION_ERROR'
    MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD'
    INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE'
    FIELD_TOO_LONG = 'FIELD_TOO_LONG'
    INVALID_FORMAT = 'INVALID_FORMAT'
    
    # Resource Errors
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND'
    RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS'
    RESOURCE_CONFLICT = 'RESOURCE_CONFLICT'
    
    # File Upload Errors
    FILE_TOO_LARGE = 'FILE_TOO_LARGE'
    INVALID_FILE_TYPE = 'INVALID_FILE_TYPE'
    FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED'
    
    # Recipe Specific Errors
    RECIPE_NOT_FOUND = 'RECIPE_NOT_FOUND'
    RECIPE_ALREADY_IN_CART = 'RECIPE_ALREADY_IN_CART'
    RECIPE_EXTRACTION_FAILED = 'RECIPE_EXTRACTION_FAILED'
    INVALID_RECIPE_URL = 'INVALID_RECIPE_URL'
    
    # Cart Specific Errors
    CART_ITEM_NOT_FOUND = 'CART_ITEM_NOT_FOUND'
    INVALID_QUANTITY = 'INVALID_QUANTITY'
    
    # External Service Errors
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
    EXTERNAL_SERVICE_UNAVAILABLE = 'EXTERNAL_SERVICE_UNAVAILABLE'
    
    # Server Errors
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
    DATABASE_ERROR = 'DATABASE_ERROR'


def handle_validation_error(error, context=""):
    """Convert Django ValidationError to APIError."""
    if hasattr(error, 'message_dict'):
        # Field-specific validation errors
        field_errors = {}
        for field, messages in error.message_dict.items():
            field_errors[field] = messages if isinstance(messages, list) else [messages]
        
        return APIError(
            error_code=ErrorCodes.VALIDATION_ERROR,
            message="Validation failed for one or more fields",
            details=f"Please check the field errors and correct the invalid values. {context}".strip(),
            status_code=status.HTTP_400_BAD_REQUEST,
            field_errors=field_errors
        )
    else:
        # General validation error
        return APIError(
            error_code=ErrorCodes.VALIDATION_ERROR,
            message="Validation error",
            details=str(error),
            status_code=status.HTTP_400_BAD_REQUEST
        )


def handle_integrity_error(error, context=""):
    """Convert Django IntegrityError to APIError."""
    error_msg = str(error).lower()
    
    if 'unique' in error_msg or 'duplicate' in error_msg:
        return APIError(
            error_code=ErrorCodes.RESOURCE_ALREADY_EXISTS,
            message="Resource already exists",
            details=f"A resource with these values already exists. {context}".strip(),
            status_code=status.HTTP_409_CONFLICT
        )
    else:
        return APIError(
            error_code=ErrorCodes.DATABASE_ERROR,
            message="Database constraint violation",
            details=f"The operation violates database constraints. {context}".strip(),
            status_code=status.HTTP_400_BAD_REQUEST
        )


def handle_not_found_error(resource_type, resource_id=None):
    """Generate standardized not found error."""
    if resource_id:
        details = f"{resource_type} with ID '{resource_id}' was not found or you don't have permission to access it."
    else:
        details = f"The requested {resource_type} was not found or you don't have permission to access it."
    
    return APIError(
        error_code=ErrorCodes.RESOURCE_NOT_FOUND,
        message=f"{resource_type} not found",
        details=details,
        status_code=status.HTTP_404_NOT_FOUND
    )


def handle_permission_denied_error(action, resource_type):
    """Generate standardized permission denied error."""
    return APIError(
        error_code=ErrorCodes.PERMISSION_DENIED,
        message="Permission denied",
        details=f"You don't have permission to {action} this {resource_type}. You can only {action} your own {resource_type}s.",
        status_code=status.HTTP_403_FORBIDDEN
    )


def handle_file_upload_error(error_type, file_name=None, max_size=None, allowed_types=None):
    """Generate standardized file upload errors."""
    if error_type == 'size':
        return APIError(
            error_code=ErrorCodes.FILE_TOO_LARGE,
            message="File size exceeds limit",
            details=f"The file '{file_name}' is too large. Maximum allowed size is {max_size}MB.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )
    elif error_type == 'type':
        allowed_str = ', '.join(allowed_types) if allowed_types else 'supported formats'
        return APIError(
            error_code=ErrorCodes.INVALID_FILE_TYPE,
            message="Invalid file type",
            details=f"The file '{file_name}' is not a valid file type. Allowed types: {allowed_str}.",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    elif error_type == 'upload':
        return APIError(
            error_code=ErrorCodes.FILE_UPLOAD_FAILED,
            message="File upload failed",
            details=f"Failed to upload '{file_name}'. Please check the file and try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def handle_external_service_error(service_name, error_details=None):
    """Generate standardized external service errors."""
    return APIError(
        error_code=ErrorCodes.EXTERNAL_SERVICE_ERROR,
        message=f"{service_name} service error",
        details=error_details or f"An error occurred while communicating with {service_name}. Please try again later.",
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE
    )


def safe_api_call(func):
    """Decorator to wrap API calls with standardized error handling."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Validation error in {func.__name__}: {e}")
            return handle_validation_error(e).to_response()
        except IntegrityError as e:
            logger.warning(f"Integrity error in {func.__name__}: {e}")
            return handle_integrity_error(e).to_response()
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {e}", exc_info=True)
            return APIError(
                error_code=ErrorCodes.INTERNAL_SERVER_ERROR,
                message="Internal server error",
                details="An unexpected error occurred. Please try again later.",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).to_response()
    return wrapper