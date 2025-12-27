/**
 * Beds24 API configuration
 */

export const BEDS24_CONFIG = {
  // Base URL for Beds24 API V2
  BASE_URL: process.env.BEDS24_API_BASE_URL || 'https://api.beds24.com/v2',
  
  // Rate limiting: 100 requests per 5 minutes
  RATE_LIMIT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  },
  
  // Token refresh: refresh 5 minutes before expiry
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // 5 minutes
  
  // Request timeout
  REQUEST_TIMEOUT_MS: 30 * 1000, // 30 seconds
  
  // Circuit breaker configuration
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5, // Open after 5 consecutive failures
    RESET_TIMEOUT_MS: 60 * 1000, // Try again after 1 minute
    HALF_OPEN_MAX_REQUESTS: 3, // Allow 3 requests in half-open state
  },
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000, // 1 second
    MAX_DELAY_MS: 10000, // 10 seconds
    BACKOFF_MULTIPLIER: 2,
  },
} as const;

