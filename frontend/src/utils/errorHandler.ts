/**
 * Enhanced error handling utilities for user-friendly error messages
 */

export interface APIError extends Error {
  code?: string;
  details?: string;
  fieldErrors?: Record<string, string[]>;
  status?: number;
}

export interface ErrorDisplayInfo {
  title: string;
  message: string;
  suggestions?: string[];
  isRetryable?: boolean;
}

/**
 * Convert API errors to user-friendly display information
 */
export function getErrorDisplayInfo(error: APIError): ErrorDisplayInfo {
  const code = error.code || 'UNKNOWN_ERROR';
  const status = error.status || 0;
  
  // Handle specific error codes with user-friendly messages
  switch (code) {
    case 'AUTHENTICATION_REQUIRED':
      return {
        title: 'Authentication Required',
        message: 'Please log in to continue.',
        suggestions: ['Log in to your account', 'Create a new account if you don\'t have one'],
        isRetryable: false
      };
      
    case 'INVALID_CREDENTIALS':
      return {
        title: 'Login Failed',
        message: error.details || 'Invalid username or password.',
        suggestions: [
          'Check your username and password',
          'Make sure Caps Lock is off',
          'Try resetting your password if you forgot it'
        ],
        isRetryable: true
      };
      
    case 'PERMISSION_DENIED':
      return {
        title: 'Access Denied',
        message: error.details || 'You don\'t have permission to perform this action.',
        suggestions: ['Make sure you\'re logged in with the correct account'],
        isRetryable: false
      };
      
    case 'RESOURCE_NOT_FOUND':
      return {
        title: 'Not Found',
        message: error.details || 'The requested item was not found.',
        suggestions: [
          'Check if the item still exists',
          'Refresh the page and try again',
          'Make sure you have permission to access this item'
        ],
        isRetryable: true
      };
      
    case 'RECIPE_NOT_FOUND':
      return {
        title: 'Recipe Not Found',
        message: error.details || 'The recipe you\'re looking for was not found.',
        suggestions: [
          'Check if the recipe still exists',
          'Make sure you have permission to access this recipe',
          'Try searching for the recipe again'
        ],
        isRetryable: true
      };
      
    case 'RECIPE_ALREADY_IN_CART':
      return {
        title: 'Recipe Already Added',
        message: error.details || 'This recipe is already in your cart.',
        suggestions: [
          'Update the serving size if needed',
          'Check your cart to see the current recipe'
        ],
        isRetryable: false
      };
      
    case 'CART_ITEM_NOT_FOUND':
      return {
        title: 'Item Not Found',
        message: error.details || 'The cart item was not found.',
        suggestions: [
          'Refresh your cart',
          'The item may have been removed already'
        ],
        isRetryable: true
      };
      
    case 'INVALID_QUANTITY':
      return {
        title: 'Invalid Quantity',
        message: error.details || 'Please enter a valid quantity.',
        suggestions: [
          'Enter a positive number',
          'Use decimal values for partial quantities (e.g., 0.5)'
        ],
        isRetryable: true
      };
      
    case 'FILE_TOO_LARGE':
      return {
        title: 'File Too Large',
        message: error.details || 'The file you\'re trying to upload is too large.',
        suggestions: [
          'Compress the image before uploading',
          'Use a smaller image file',
          'Try a different image format'
        ],
        isRetryable: true
      };
      
    case 'INVALID_FILE_TYPE':
      return {
        title: 'Invalid File Type',
        message: error.details || 'Please upload a valid image file.',
        suggestions: [
          'Use PNG, JPEG, GIF, WEBP, or BMP format',
          'Make sure the file is actually an image',
          'Try converting the file to a supported format'
        ],
        isRetryable: true
      };
      
    case 'RECIPE_EXTRACTION_FAILED':
      return {
        title: 'Recipe Extraction Failed',
        message: error.details || 'Could not extract recipe information.',
        suggestions: [
          'Make sure the URL contains a valid recipe',
          'Try a different recipe website',
          'Check if the image is clear and readable',
          'Enter the recipe manually if automatic extraction fails'
        ],
        isRetryable: true
      };
      
    case 'INVALID_RECIPE_URL':
      return {
        title: 'Invalid Recipe URL',
        message: error.details || 'Please enter a valid recipe URL.',
        suggestions: [
          'Make sure the URL starts with http:// or https://',
          'Check for typos in the URL',
          'Try copying and pasting the URL from your browser'
        ],
        isRetryable: true
      };
      
    case 'EXTERNAL_SERVICE_ERROR':
      return {
        title: 'Service Unavailable',
        message: error.details || 'An external service is currently unavailable.',
        suggestions: [
          'Try again in a few minutes',
          'Check your internet connection',
          'Contact support if the problem persists'
        ],
        isRetryable: true
      };
      
    case 'VALIDATION_ERROR':
      return {
        title: 'Validation Error',
        message: error.details || 'Please check your input and try again.',
        suggestions: [
          'Review the highlighted fields',
          'Make sure all required fields are filled',
          'Check the format of your input'
        ],
        isRetryable: true
      };
      
    case 'MISSING_REQUIRED_FIELD':
      return {
        title: 'Missing Information',
        message: error.details || 'Please fill in all required fields.',
        suggestions: [
          'Check for empty required fields',
          'Make sure all necessary information is provided'
        ],
        isRetryable: true
      };
      
    default:
      // Handle HTTP status codes for unknown error codes
      if (status >= 500) {
        return {
          title: 'Server Error',
          message: 'Something went wrong on our end. Please try again later.',
          suggestions: [
            'Try again in a few minutes',
            'Refresh the page',
            'Contact support if the problem persists'
          ],
          isRetryable: true
        };
      } else if (status === 429) {
        return {
          title: 'Too Many Requests',
          message: 'You\'re making requests too quickly. Please slow down.',
          suggestions: [
            'Wait a moment before trying again',
            'Avoid clicking buttons multiple times'
          ],
          isRetryable: true
        };
      } else if (status >= 400) {
        return {
          title: 'Request Error',
          message: error.details || error.message || 'There was a problem with your request.',
          suggestions: [
            'Check your input and try again',
            'Make sure you\'re logged in',
            'Refresh the page if the problem persists'
          ],
          isRetryable: true
        };
      }
      
      return {
        title: 'Unexpected Error',
        message: error.message || 'An unexpected error occurred.',
        suggestions: [
          'Try refreshing the page',
          'Check your internet connection',
          'Contact support if the problem persists'
        ],
        isRetryable: true
      };
  }
}

/**
 * Format field errors for display
 */
export function formatFieldErrors(fieldErrors: Record<string, string[]>): string {
  const errors = Object.entries(fieldErrors)
    .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
    .join('\n');
  
  return errors;
}

/**
 * Check if an error is retryable based on its code and status
 */
export function isRetryableError(error: APIError): boolean {
  const info = getErrorDisplayInfo(error);
  return info.isRetryable ?? true;
}

/**
 * Get a short error message suitable for toasts/notifications
 */
export function getShortErrorMessage(error: APIError): string {
  const info = getErrorDisplayInfo(error);
  return info.message;
}

/**
 * Get detailed error information for error pages/modals
 */
export function getDetailedErrorMessage(error: APIError): string {
  const info = getErrorDisplayInfo(error);
  let message = info.message;
  
  if (info.suggestions && info.suggestions.length > 0) {
    message += '\n\nSuggestions:\n• ' + info.suggestions.join('\n• ');
  }
  
  if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    message += '\n\nField errors:\n' + formatFieldErrors(error.fieldErrors);
  }
  
  return message;
}