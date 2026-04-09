type ErrorDetails = {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
  cause?: unknown;
};

/**
 * Utility function for comprehensive error logging.
 * Safely inspects error objects without risking serialization failures.
 * 
 * @param context - A descriptive string about where/what caused the error
 * @param error - The error object to inspect
 */
export function logError(context: string, originalError: unknown): void {
  // Some libraries wrap the error under an `error` property. Unwrap if present.
  let error: unknown = originalError as any;
  if (error && typeof error === 'object' && 'error' in (error as any)) {
    const nested = (error as any).error;
    if (nested !== undefined) {
      error = nested;
    }
  }

  // Check if this is an empty/meaningless error, prioritizing real Error instances first
  let isEmptyError = false;
  if (error == null) {
    isEmptyError = true;
  } else if (error instanceof Error) {
    isEmptyError = !error.message && !error.stack;
  } else if (typeof error === 'object') {
    isEmptyError = Object.keys(error as object).length === 0;
  }

  if (isEmptyError) {
    console.warn(`[ERROR] ${context}: Empty or meaningless error object`);
    return;
  }
  
  console.log(`=== ERROR ANALYSIS: ${context} ===`);
  console.log('typeof error:', typeof error);
  console.log('error === null:', error === null);
  console.log('error === undefined:', error === undefined);
  
  if (error) {
    // Safely access common error properties
    console.log('error.message:', (error as any).message);
    console.log('error.name:', (error as any).name);
    console.log('error.code:', (error as any).code);
    
    // For database/Prisma errors, these might be useful
    console.log('error.meta:', (error as any).meta);
    console.log('error.clientVersion:', (error as any).clientVersion);
    
    // Stack trace (usually the most helpful)
    console.log('error.stack:', (error as any).stack);
    
    // Attempt JSON serialization as fallback, but catch if it fails
    try {
      console.log('error (JSON):', JSON.stringify(error, null, 2));
    } catch (serializationError) {
      console.log('error (JSON serialization failed):', (serializationError as any).message);
    }
  }
  
  console.log(`=== END ERROR ANALYSIS: ${context} ===`);
}

/**
 * Utility function for logging errors in API routes.
 * Combines error logging with standardized error response.
 * 
 * @param context - A descriptive string about the operation that failed
 * @param error - The error object to inspect
 * @param customMessage - Optional custom error message for the client
 * @returns A standardized error response
 */
export function logAndReturnError(context: string, error: unknown, customMessage?: string) {
  logError(context, error);
  
  // You could extend this to return different status codes based on error type
  const statusCode = (error as any)?.name === 'UnauthorizedError' ? 401 : 500;
  const message = customMessage || 'Internal Server Error';
  
  return {
    error: message,
    statusCode
  };
}

export const logErrorDetails = (error: unknown, context?: string): ErrorDetails => {
  const details: ErrorDetails = {
    message: 'Unknown error occurred'
  };

  if (error instanceof Error) {
    details.message = error.message;
    details.name = error.name;
    details.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    
    // Capture any error code
    if ('code' in error) {
      details.code = (error as { code?: string }).code;
    }

    // Capture error cause if available
    if (error.cause) {
      details.cause = error.cause;
    }
  } else if (typeof error === 'string') {
    details.message = error;
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔴 Error${context ? ` in ${context}` : ''}:`, details);
  }

  return details;
}; 