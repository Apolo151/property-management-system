/**
 * QloApps API Client
 *
 * HTTP client for QloApps WebService API with:
 * - Basic Auth authentication (API key as username)
 * - Rate limiting with token bucket algorithm
 * - Circuit breaker pattern for resilience
 * - Exponential backoff retry logic
 * - Comprehensive error handling
 *
 * QloApps is built on PrestaShop and uses similar API patterns.
 */

import { QLOAPPS_CONFIG } from './qloapps_config.js';
import type {
  QloAppsConnectionConfig,
  QloAppsRoomType,
  QloAppsCustomer,
  QloAppsBooking,
  QloAppsBookingCreateRequest,
  QloAppsBookingUpdateRequest,
  QloAppsCustomerCreateRequest,
  QloAppsCustomerUpdateRequest,
  GetBookingsParams,
  GetRoomTypesParams,
  GetCustomersParams,
  QloAppsConnectionTestResult,
  QloAppsRequestOptions,
  QloAppsRateLimitInfo,
} from './qloapps_types.js';
import {
  QloAppsError,
  QloAppsAuthenticationError,
  QloAppsRateLimitError,
  QloAppsNetworkError,
  QloAppsTimeoutError,
  QloAppsCircuitBreakerError,
  QloAppsConfigurationError,
  createQloAppsError,
} from './qloapps_errors.js';

// ============================================================================
// Circuit Breaker State
// ============================================================================

enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Too many failures, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

// ============================================================================
// Rate Limiter (Token Bucket Algorithm)
// ============================================================================

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = maxRequests / windowMs;
  }

  /**
   * Try to consume a token
   * @returns true if token consumed, false if rate limited
   */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Get time until next token available (ms)
   */
  getTimeUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    const tokensNeeded = 1 - this.tokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenSuccessCount: number = 0;
  private openedAt: Date | null = null;

  /**
   * Check if request should be allowed
   */
  canProceed(): boolean {
    const now = Date.now();

    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (now - this.lastFailureTime >= QLOAPPS_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenSuccessCount = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow limited requests
    if (this.halfOpenSuccessCount >= QLOAPPS_CONFIG.CIRCUIT_BREAKER.HALF_OPEN_MAX_REQUESTS) {
      this.state = CircuitState.OPEN;
      this.lastFailureTime = now;
      return false;
    }

    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= QLOAPPS_CONFIG.CIRCUIT_BREAKER.HALF_OPEN_MAX_REQUESTS) {
        // Successfully recovered
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.halfOpenSuccessCount = 0;
        this.openedAt = null;
      }
    } else {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= QLOAPPS_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD) {
      this.state = CircuitState.OPEN;
      this.openedAt = new Date();
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open, go back to open
      this.state = CircuitState.OPEN;
      this.halfOpenSuccessCount = 0;
      this.openedAt = new Date();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getOpenedAt(): Date | null {
    return this.openedAt;
  }

  getResetAt(): Date | null {
    if (this.state === CircuitState.OPEN && this.lastFailureTime) {
      return new Date(this.lastFailureTime + QLOAPPS_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS);
    }
    return null;
  }
}

// ============================================================================
// QloApps API Client
// ============================================================================

/**
 * QloApps API Client
 *
 * Handles all HTTP communication with QloApps WebService API including:
 * - Authentication (Basic Auth with API key)
 * - Rate limiting
 * - Circuit breaker pattern
 * - Retry with exponential backoff
 */
export class QloAppsClient {
  private readonly config: QloAppsConnectionConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly debug: boolean;

  constructor(config: QloAppsConnectionConfig) {
    // Validate configuration
    if (!config.baseUrl) {
      throw new QloAppsConfigurationError('QloApps base URL is required', 'baseUrl');
    }
    if (!config.apiKey) {
      throw new QloAppsConfigurationError('QloApps API key is required', 'apiKey');
    }
    if (!config.hotelId) {
      throw new QloAppsConfigurationError('QloApps hotel ID is required', 'hotelId');
    }

    // Normalize base URL (remove trailing slash)
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      timeout: config.timeout || QLOAPPS_CONFIG.DEFAULT_TIMEOUT_MS,
    };

    this.debug = config.debug || false;

    this.rateLimiter = new RateLimiter(
      QLOAPPS_CONFIG.RATE_LIMIT_MAX_REQUESTS,
      QLOAPPS_CONFIG.RATE_LIMIT_WINDOW_MS
    );

    this.circuitBreaker = new CircuitBreaker();
  }

  // ==========================================================================
  // Connection Test
  // ==========================================================================

  /**
   * Test connection to QloApps API
   * @returns Connection test result with details
   */
  async testConnection(): Promise<QloAppsConnectionTestResult> {
    const startTime = Date.now();

    try {
      // Try to fetch the API root to get available resources
      const response = await this.makeRequest<Record<string, unknown>>(
        QLOAPPS_CONFIG.ENDPOINTS.ROOT,
        { method: 'GET' }
      );

      const responseTimeMs = Date.now() - startTime;

      // Extract available resources from response
      const availableResources = Object.keys(response).filter(
        (key) => typeof response[key] === 'object'
      );

      return {
        success: true,
        message: 'Successfully connected to QloApps',
        availableResources,
        responseTimeMs,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      if (error instanceof QloAppsError) {
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          error: error.message,
          responseTimeMs,
        };
      }

      return {
        success: false,
        message: 'Connection failed: Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTimeMs,
      };
    }
  }

  // ==========================================================================
  // Room Types API
  // ==========================================================================

  /**
   * Get all room types from QloApps
   * @param params Optional filter parameters
   * @returns Array of room types
   */
  async getRoomTypes(params?: GetRoomTypesParams): Promise<QloAppsRoomType[]> {
    const query: Record<string, string | number | undefined> = {
      display: 'full',
    };

    if (params?.hotelId) {
      query['filter[id_hotel]'] = params.hotelId;
    }
    if (params?.active !== undefined) {
      query['filter[active]'] = params.active ? 1 : 0;
    }
    if (params?.limit) {
      query.limit = params.limit;
    }
    if (params?.offset) {
      query.offset = params.offset;
    }

    const response = await this.makeRequest<{ room_types?: QloAppsRoomType[] }>(
      QLOAPPS_CONFIG.ENDPOINTS.ROOM_TYPES,
      { method: 'GET', query }
    );

    return response.room_types || [];
  }

  /**
   * Get a specific room type by ID
   * @param id Room type ID
   * @returns Room type or null if not found
   */
  async getRoomType(id: number): Promise<QloAppsRoomType | null> {
    try {
      const response = await this.makeRequest<{ room_type?: QloAppsRoomType }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.ROOM_TYPES}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      return response.room_type || null;
    } catch (error) {
      if (error instanceof QloAppsError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ==========================================================================
  // Bookings API
  // ==========================================================================

  /**
   * Get bookings from QloApps
   * @param params Filter parameters
   * @returns Array of bookings
   */
  async getBookings(params?: GetBookingsParams): Promise<QloAppsBooking[]> {
    const query: Record<string, string | number | undefined> = {
      display: params?.display === 'full' ? 'full' : 'full',
    };

    if (params?.hotelId) {
      query['filter[id_hotel]'] = params.hotelId;
    }
    if (params?.bookingStatus !== undefined) {
      query['filter[booking_status]'] = params.bookingStatus;
    }
    if (params?.dateFrom) {
      query['filter[date_from]'] = `>=${params.dateFrom}`;
    }
    if (params?.dateTo) {
      query['filter[date_to]'] = `<=${params.dateTo}`;
    }
    if (params?.modifiedSince) {
      query['filter[date_upd]'] = `>=${params.modifiedSince}`;
    }
    if (params?.limit) {
      query.limit = `${params.offset || 0},${params.limit}`;
    }

    const response = await this.makeRequest<{ bookings?: QloAppsBooking[] }>(
      QLOAPPS_CONFIG.ENDPOINTS.BOOKINGS,
      { method: 'GET', query }
    );

    return response.bookings || [];
  }

  /**
   * Get a specific booking by ID
   * @param id Booking ID
   * @returns Booking or null if not found
   */
  async getBooking(id: number): Promise<QloAppsBooking | null> {
    try {
      const response = await this.makeRequest<{ booking?: QloAppsBooking }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.BOOKINGS}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      return response.booking || null;
    } catch (error) {
      if (error instanceof QloAppsError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new booking in QloApps
   * @param booking Booking data
   * @returns ID of created booking
   */
  async createBooking(booking: QloAppsBookingCreateRequest): Promise<number> {
    const response = await this.makeRequest<{ booking?: { id: number } }>(
      QLOAPPS_CONFIG.ENDPOINTS.BOOKINGS,
      {
        method: 'POST',
        body: { booking },
      }
    );

    if (!response.booking?.id) {
      throw new QloAppsError(
        QLOAPPS_CONFIG.ERROR_CODES.API_ERROR,
        'Failed to create booking: No ID returned'
      );
    }

    return response.booking.id;
  }

  /**
   * Update an existing booking
   * @param update Booking update data (must include id)
   * @returns true if successful
   */
  async updateBooking(update: QloAppsBookingUpdateRequest): Promise<boolean> {
    await this.makeRequest(
      `${QLOAPPS_CONFIG.ENDPOINTS.BOOKINGS}/${update.id}`,
      {
        method: 'PUT',
        body: { booking: update },
      }
    );

    return true;
  }

  /**
   * Cancel a booking
   * @param id Booking ID
   * @returns true if successful
   */
  async cancelBooking(id: number): Promise<boolean> {
    return this.updateBooking({
      id,
      booking_status: QLOAPPS_CONFIG.BOOKING_STATUS.CANCELLED,
    });
  }

  // ==========================================================================
  // Customers API
  // ==========================================================================

  /**
   * Get customers from QloApps
   * @param params Filter parameters
   * @returns Array of customers
   */
  async getCustomers(params?: GetCustomersParams): Promise<QloAppsCustomer[]> {
    const query: Record<string, string | number | undefined> = {
      display: 'full',
    };

    if (params?.email) {
      query['filter[email]'] = params.email;
    }
    if (params?.active !== undefined) {
      query['filter[active]'] = params.active ? 1 : 0;
    }
    if (params?.limit) {
      query.limit = `${params.offset || 0},${params.limit}`;
    }

    const response = await this.makeRequest<{ customers?: QloAppsCustomer[] }>(
      QLOAPPS_CONFIG.ENDPOINTS.CUSTOMERS,
      { method: 'GET', query }
    );

    return response.customers || [];
  }

  /**
   * Get a specific customer by ID
   * @param id Customer ID
   * @returns Customer or null if not found
   */
  async getCustomer(id: number): Promise<QloAppsCustomer | null> {
    try {
      const response = await this.makeRequest<{ customer?: QloAppsCustomer }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.CUSTOMERS}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      return response.customer || null;
    } catch (error) {
      if (error instanceof QloAppsError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Find customer by email
   * @param email Customer email
   * @returns Customer or null if not found
   */
  async findCustomerByEmail(email: string): Promise<QloAppsCustomer | null> {
    const customers = await this.getCustomers({ email, limit: 1 });
    return customers.length > 0 ? (customers[0] ?? null) : null;
  }

  /**
   * Create a new customer in QloApps
   * @param customer Customer data
   * @returns ID of created customer
   */
  async createCustomer(customer: QloAppsCustomerCreateRequest): Promise<number> {
    // QloApps requires a password for customer creation
    const customerWithPassword = {
      ...customer,
      passwd: customer.passwd || this.generateRandomPassword(),
      active: customer.active ?? true,
    };

    const response = await this.makeRequest<{ customer?: { id: number } }>(
      QLOAPPS_CONFIG.ENDPOINTS.CUSTOMERS,
      {
        method: 'POST',
        body: { customer: customerWithPassword },
      }
    );

    if (!response.customer?.id) {
      throw new QloAppsError(
        QLOAPPS_CONFIG.ERROR_CODES.API_ERROR,
        'Failed to create customer: No ID returned'
      );
    }

    return response.customer.id;
  }

  /**
   * Update an existing customer
   * @param update Customer update data (must include id)
   * @returns true if successful
   */
  async updateCustomer(update: QloAppsCustomerUpdateRequest): Promise<boolean> {
    await this.makeRequest(
      `${QLOAPPS_CONFIG.ENDPOINTS.CUSTOMERS}/${update.id}`,
      {
        method: 'PUT',
        body: { customer: update },
      }
    );

    return true;
  }

  // ==========================================================================
  // Hotels API
  // ==========================================================================

  /**
   * Get hotel information
   * @param hotelId Optional hotel ID (uses config hotelId if not provided)
   * @returns Hotel information
   */
  async getHotel(hotelId?: number): Promise<Record<string, unknown> | null> {
    const id = hotelId || this.config.hotelId;

    try {
      const response = await this.makeRequest<{ hotel?: Record<string, unknown> }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.HOTELS}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      return response.hotel || null;
    } catch (error) {
      if (error instanceof QloAppsError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ==========================================================================
  // Internal: HTTP Request Handler
  // ==========================================================================

  /**
   * Make HTTP request to QloApps API with retry logic
   * @param endpoint API endpoint
   * @param options Request options
   * @returns Parsed response data
   */
  private async makeRequest<T>(
    endpoint: string,
    options: QloAppsRequestOptions = {}
  ): Promise<T> {
    // Check circuit breaker
    if (!this.circuitBreaker.canProceed()) {
      throw new QloAppsCircuitBreakerError(
        'QloApps circuit breaker is open. Too many consecutive failures.',
        this.circuitBreaker.getOpenedAt(),
        this.circuitBreaker.getResetAt()
      );
    }

    // Check rate limit
    if (!options.skipRateLimit && !this.rateLimiter.tryConsume()) {
      const waitTime = this.rateLimiter.getTimeUntilNextToken();
      throw new QloAppsRateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
        waitTime
      );
    }

    let lastError: Error | undefined;
    const maxRetries = QLOAPPS_CONFIG.MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeRequest<T>(endpoint, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (error instanceof QloAppsAuthenticationError) {
          this.circuitBreaker.recordFailure();
          throw error;
        }

        if (error instanceof QloAppsRateLimitError) {
          // Wait for rate limit to reset and retry
          if (error.retryAfter && attempt < maxRetries) {
            await this.sleep(error.retryAfter);
            continue;
          }
          throw error;
        }

        // Record failure for circuit breaker
        if (
          error instanceof QloAppsError &&
          error.statusCode !== undefined &&
          error.statusCode >= 500
        ) {
          this.circuitBreaker.recordFailure();
        }

        // Retry with exponential backoff for retryable errors
        if (
          attempt < maxRetries &&
          error instanceof QloAppsError &&
          this.isRetryableError(error)
        ) {
          const delay = Math.min(
            QLOAPPS_CONFIG.RETRY_INITIAL_DELAY_MS *
              Math.pow(QLOAPPS_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt),
            QLOAPPS_CONFIG.RETRY_MAX_DELAY_MS
          );

          this.log(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError || new QloAppsError(QLOAPPS_CONFIG.ERROR_CODES.API_ERROR, 'Request failed');
  }

  /**
   * Execute a single HTTP request
   */
  private async executeRequest<T>(
    endpoint: string,
    options: QloAppsRequestOptions
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    // Build headers
    const headers: Record<string, string> = {
      Authorization: `Basic ${this.encodeBasicAuth(this.config.apiKey, '')}`,
      [QLOAPPS_CONFIG.HEADERS.OUTPUT_FORMAT]: 'JSON',
      ...options.headers,
    };

    // Add Content-Type for requests with body
    if (options.body) {
      headers[QLOAPPS_CONFIG.HEADERS.CONTENT_TYPE] = 'application/json';
    }

    // Build query string
    let fullUrl = url;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        fullUrl = `${url}?${queryString}`;
      }
    }

    this.log(`${method} ${fullUrl}`);

    try {
      const controller = new AbortController();
      const timeoutMs = options.timeout || this.config.timeout || QLOAPPS_CONFIG.DEFAULT_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const requestBody = options.body ? JSON.stringify(options.body) : null;
      
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        const error = createQloAppsError(response.status, errorData);
        throw error;
      }

      // Record success
      this.circuitBreaker.recordSuccess();

      // Parse response
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        // QloApps might return XML, try to handle it
        this.log(`Warning: Response is not valid JSON: ${text.substring(0, 200)}`);
        throw new QloAppsError(
          QLOAPPS_CONFIG.ERROR_CODES.API_ERROR,
          'Invalid JSON response from QloApps'
        );
      }
    } catch (error) {
      // Handle network errors
      if (error instanceof QloAppsError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new QloAppsTimeoutError(
            this.config.timeout || QLOAPPS_CONFIG.DEFAULT_TIMEOUT_MS,
            error
          );
        }
        throw new QloAppsNetworkError(`Network error: ${error.message}`, error);
      }

      throw new QloAppsNetworkError('Unknown network error');
    }
  }

  /**
   * Parse error response body
   */
  private async parseErrorResponse(
    response: Response
  ): Promise<{ code?: string; message?: string; errors?: Array<{ field: string; message: string }> }> {
    try {
      const text = await response.text();
      if (!text) {
        return { message: response.statusText };
      }

      try {
        const json = JSON.parse(text);
        return {
          code: json.error?.code || json.code,
          message: json.error?.message || json.message || text,
          errors: json.errors,
        };
      } catch {
        return { message: text };
      }
    } catch {
      return { message: response.statusText };
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: QloAppsError): boolean {
    // Retry on server errors
    if (error.statusCode !== undefined && error.statusCode >= 500) {
      return true;
    }

    // Retry on network errors
    if (error instanceof QloAppsNetworkError) {
      return error.isRetryable;
    }

    return false;
  }

  /**
   * Encode Basic Auth credentials
   */
  private encodeBasicAuth(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    // Use Buffer for Node.js or btoa for browsers
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(credentials).toString('base64');
    }
    return btoa(credentials);
  }

  /**
   * Generate a random password for customer creation
   */
  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log debug message
   */
  private log(message: string): void {
    if (this.debug) {
      console.log(`[QloAppsClient] ${message}`);
    }
  }

  // ==========================================================================
  // Public Utility Methods
  // ==========================================================================

  /**
   * Get circuit breaker state (for monitoring)
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Get the configured hotel ID
   */
  getHotelId(): number {
    return this.config.hotelId;
  }

  /**
   * Get the configured base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}
