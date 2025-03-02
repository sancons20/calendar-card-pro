/**
 * Error handling utilities for Calendar Card Pro
 *
 * Provides standardized error handling and logging capabilities.
 */

/**
 * Custom error class for Calendar Card Pro
 */
export class CalendarCardError extends Error {
  /**
   * Create a new CalendarCardError
   *
   * @param message - Error message
   * @param severity - Error severity level
   */
  constructor(
    public message: string,
    public severity: 'warning' | 'error' = 'error',
  ) {
    super(message);
    this.name = 'CalendarCardError';
  }
}

/**
 * Log an error with consistent formatting
 *
 * @param error - Error object or message
 * @param context - Additional context information
 */
export function logError(error: unknown, context?: string): void {
  const prefix = 'Calendar Card Pro';
  const contextStr = context ? ` [${context}]` : '';

  if (error instanceof CalendarCardError) {
    if (error.severity === 'warning') {
      console.warn(`${prefix}${contextStr}: ${error.message}`);
    } else {
      console.error(`${prefix}${contextStr}: ${error.message}`);
    }
  } else if (error instanceof Error) {
    console.error(`${prefix}${contextStr}: ${error.message}`);
    console.debug(error.stack);
  } else {
    console.error(`${prefix}${contextStr}:`, error);
  }
}

/**
 * Handle API errors in a consistent way
 *
 * @param error - Error from API call
 * @param entityId - Optional entity ID for context
 * @returns Formatted error object
 */
export function handleApiError(error: unknown, entityId?: string): CalendarCardError {
  let message = 'Unknown API error occurred';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as { message: unknown }).message);
  }

  const context = entityId ? `Entity: ${entityId}` : undefined;
  const calendarError = new CalendarCardError(message);

  logError(calendarError, context);
  return calendarError;
}
