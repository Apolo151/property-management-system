/**
 * QloApps Integration Error Classes
 *
 * Custom error classes for handling QloApps API errors with proper
 * error codes, status codes, and context for debugging and logging.
 */

import { QLOAPPS_CONFIG, type QloAppsErrorCode } from './qloapps_config.js';

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all QloApps integration errors.
 * Provides consistent error structure with code, status, and context.
 */
export class QloAppsError extends Error {
  constructor(
    public code: QloAppsErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'QloAppsError';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      stack: this.stack,
      originalError: this.originalError?.message,
    };
  }
}

// ============================================================================
// Authentication Errors
// ============================================================================

/**
 * Error when QloApps authentication fails.
 * Usually indicates invalid API key or expired credentials.
 */
export class QloAppsAuthenticationError extends QloAppsError {
  constructor(
    message: string = 'Authentication with QloApps failed. Check your API key.',
    originalError?: Error
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.AUTHENTICATION_ERROR, message, 401, originalError);
    this.name = 'QloAppsAuthenticationError';
  }
}

// ============================================================================
// Rate Limit Errors
// ============================================================================

/**
 * Error when QloApps rate limit is exceeded.
 * Includes retry information for automatic retry logic.
 */
export class QloAppsRateLimitError extends QloAppsError {
  constructor(
    message: string = 'QloApps API rate limit exceeded',
    public retryAfter?: number,
    public rateLimitInfo?: {
      limit: number;
      remaining: number;
      resetsIn: number;
    }
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.RATE_LIMIT_ERROR, message, 429);
    this.name = 'QloAppsRateLimitError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter,
      rateLimitInfo: this.rateLimitInfo,
    };
  }
}

// ============================================================================
// Network Errors
// ============================================================================

/**
 * Error for network-level failures (timeouts, connection refused, etc.)
 */
export class QloAppsNetworkError extends QloAppsError {
  constructor(
    message: string = 'Network error connecting to QloApps',
    originalError?: Error,
    public isRetryable: boolean = true
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.NETWORK_ERROR, message, undefined, originalError);
    this.name = 'QloAppsNetworkError';
  }
}

/**
 * Error when request times out
 */
export class QloAppsTimeoutError extends QloAppsNetworkError {
  constructor(
    public timeoutMs: number,
    originalError?: Error
  ) {
    super(`QloApps request timed out after ${timeoutMs}ms`, originalError, true);
    this.name = 'QloAppsTimeoutError';
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Error when request validation fails (invalid data sent to API)
 */
export class QloAppsValidationError extends QloAppsError {
  constructor(
    message: string = 'Validation error in QloApps request',
    public validationErrors?: Array<{ field: string; message: string }>
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.VALIDATION_ERROR, message, 400);
    this.name = 'QloAppsValidationError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

// ============================================================================
// Not Found Errors
// ============================================================================

/**
 * Error when requested resource is not found in QloApps
 */
export class QloAppsNotFoundError extends QloAppsError {
  constructor(
    public resourceType: string,
    public resourceId: string | number
  ) {
    super(
      QLOAPPS_CONFIG.ERROR_CODES.NOT_FOUND_ERROR,
      `QloApps ${resourceType} with ID ${resourceId} not found`,
      404
    );
    this.name = 'QloAppsNotFoundError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      resourceType: this.resourceType,
      resourceId: this.resourceId,
    };
  }
}

// ============================================================================
// API Errors
// ============================================================================

/**
 * General API error from QloApps server
 */
export class QloAppsApiError extends QloAppsError {
  constructor(
    message: string,
    statusCode: number,
    public apiErrorCode?: string,
    originalError?: Error
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.API_ERROR, message, statusCode, originalError);
    this.name = 'QloAppsApiError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      apiErrorCode: this.apiErrorCode,
    };
  }
}

// ============================================================================
// Circuit Breaker Errors
// ============================================================================

/**
 * Error when circuit breaker is open (too many failures)
 */
export class QloAppsCircuitBreakerError extends QloAppsError {
  constructor(
    message: string = 'QloApps circuit breaker is open. Too many consecutive failures.',
    public openedAt?: Date | null,
    public resetAt?: Date | null
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.CIRCUIT_BREAKER_OPEN, message, 503);
    this.name = 'QloAppsCircuitBreakerError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      openedAt: this.openedAt?.toISOString(),
      resetAt: this.resetAt?.toISOString(),
    };
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Error when QloApps configuration is missing or invalid
 */
export class QloAppsConfigurationError extends QloAppsError {
  constructor(
    message: string,
    public field?: string
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.CONFIGURATION_ERROR, message);
    this.name = 'QloAppsConfigurationError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
    };
  }
}

// ============================================================================
// Mapping Errors
// ============================================================================

/**
 * Error when entity mapping fails (e.g., room type not mapped)
 */
export class QloAppsMappingError extends QloAppsError {
  constructor(
    message: string,
    public entityType: string,
    public localId?: string,
    public qloAppsId?: number
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.MAPPING_ERROR, message);
    this.name = 'QloAppsMappingError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      entityType: this.entityType,
      localId: this.localId,
      qloAppsId: this.qloAppsId,
    };
  }
}

// ============================================================================
// Sync Errors
// ============================================================================

/**
 * Error during sync operation
 */
export class QloAppsSyncError extends QloAppsError {
  constructor(
    message: string,
    public syncType: string,
    public direction: 'inbound' | 'outbound',
    public failedCount?: number,
    originalError?: Error
  ) {
    super(QLOAPPS_CONFIG.ERROR_CODES.SYNC_ERROR, message, undefined, originalError);
    this.name = 'QloAppsSyncError';
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      syncType: this.syncType,
      direction: this.direction,
      failedCount: this.failedCount,
    };
  }
}

// ============================================================================
// Error Factory
// ============================================================================

/**
 * Create appropriate error from HTTP response
 */
export function createQloAppsError(
  statusCode: number,
  errorData?: {
    code?: string;
    message?: string;
    errors?: Array<{ field: string; message: string }>;
  },
  originalError?: Error
): QloAppsError {
  const message = errorData?.message || `QloApps API error: HTTP ${statusCode}`;
  const apiErrorCode = errorData?.code;

  switch (statusCode) {
    case 401:
    case 403:
      return new QloAppsAuthenticationError(message, originalError);

    case 404:
      return new QloAppsApiError(message, statusCode, apiErrorCode, originalError);

    case 400:
      return new QloAppsValidationError(message, errorData?.errors);

    case 429:
      return new QloAppsRateLimitError(message);

    case 500:
    case 502:
    case 503:
    case 504:
      return new QloAppsApiError(message, statusCode, apiErrorCode, originalError);

    default:
      return new QloAppsApiError(message, statusCode, apiErrorCode, originalError);
  }
}

/**
 * Check if an error is a QloApps error
 */
export function isQloAppsError(error: unknown): error is QloAppsError {
  return error instanceof QloAppsError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof QloAppsRateLimitError) {
    return true;
  }

  if (error instanceof QloAppsNetworkError) {
    return error.isRetryable;
  }

  if (error instanceof QloAppsApiError) {
    // Server errors are typically retryable
    return error.statusCode !== undefined && error.statusCode >= 500;
  }

  if (error instanceof QloAppsCircuitBreakerError) {
    return false; // Don't retry when circuit is open
  }

  return false;
}
