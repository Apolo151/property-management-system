import { Beds24ErrorCode } from './beds24_types.js';

/**
 * Base error class for Beds24 integration
 */
export class Beds24Error extends Error {
  constructor(
    public code: Beds24ErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'Beds24Error';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication-related errors
 */
export class Beds24AuthenticationError extends Beds24Error {
  constructor(message: string, originalError?: Error) {
    super(Beds24ErrorCode.AUTHENTICATION_ERROR, message, 401, originalError);
    this.name = 'Beds24AuthenticationError';
  }
}

/**
 * Rate limit exceeded error
 */
export class Beds24RateLimitError extends Beds24Error {
  constructor(
    message: string,
    public retryAfter?: number,
    public rateLimitInfo?: {
      limit: number;
      remaining: number;
      resetsIn: number;
    }
  ) {
    super(Beds24ErrorCode.RATE_LIMIT_ERROR, message, 429);
    this.name = 'Beds24RateLimitError';
  }
}

/**
 * Network/timeout errors
 */
export class Beds24NetworkError extends Beds24Error {
  constructor(message: string, originalError?: Error) {
    super(Beds24ErrorCode.NETWORK_ERROR, message, undefined, originalError);
    this.name = 'Beds24NetworkError';
  }
}

/**
 * Request validation errors
 */
export class Beds24ValidationError extends Beds24Error {
  constructor(message: string, public validationErrors?: Record<string, string[]>) {
    super(Beds24ErrorCode.VALIDATION_ERROR, message, 400);
    this.name = 'Beds24ValidationError';
  }
}

/**
 * General API errors
 */
export class Beds24ApiError extends Beds24Error {
  constructor(
    message: string,
    statusCode: number,
    public apiErrorCode?: string,
    originalError?: Error
  ) {
    super(Beds24ErrorCode.API_ERROR, message, statusCode, originalError);
    this.name = 'Beds24ApiError';
  }
}

/**
 * Circuit breaker is open (too many failures)
 */
export class Beds24CircuitBreakerError extends Beds24Error {
  constructor(message: string = 'Circuit breaker is open. Too many failures.') {
    super(Beds24ErrorCode.CIRCUIT_BREAKER_OPEN, message);
    this.name = 'Beds24CircuitBreakerError';
  }
}

/**
 * Helper to create appropriate error from HTTP response
 */
export function createBeds24Error(
  statusCode: number,
  errorData?: { code?: string; message?: string },
  originalError?: Error
): Beds24Error {
  const message = errorData?.message || `Beds24 API error: ${statusCode}`;
  const apiErrorCode = errorData?.code;

  switch (statusCode) {
    case 401:
    case 403:
      return new Beds24AuthenticationError(message, originalError);
    case 429:
      return new Beds24RateLimitError(message);
    case 400:
      return new Beds24ValidationError(message);
    default:
      return new Beds24ApiError(message, statusCode, apiErrorCode, originalError);
  }
}

