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
  QloAppsRoom,
  QloAppsCustomer,
  QloAppsBooking,
  QloAppsBookingRaw,
  QloAppsBookingCreateRequest,
  QloAppsBookingUpdateRequest,
  QloAppsCustomerCreateRequest,
  QloAppsCustomerUpdateRequest,
  GetBookingsParams,
  GetRoomTypesParams,
  GetHotelRoomsParams,
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
import { normalizeQloAppsBooking } from './utils/booking_normalizer.js';

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
    console.log('[QloAppsClient] 🔍 Starting connection test...');
    console.log(`[QloAppsClient]   Base URL: ${this.config.baseUrl}`);
    console.log(`[QloAppsClient]   Hotel ID: ${this.config.hotelId}`);
    console.log(`[QloAppsClient]   Timeout: ${this.config.timeout}ms`);
    console.log(`[QloAppsClient]   Circuit Breaker State: ${this.circuitBreaker.getState()}`);

    try {
      // Test connection by fetching the hotel info (validates API key, hotel ID, and connectivity)
      // This is a real, meaningful test that proves the configuration is correct
      // Always use display=full to get complete entity data
      const endpoint = `${QLOAPPS_CONFIG.ENDPOINTS.HOTELS}/${this.config.hotelId}`;
      const fullUrl = `${this.config.baseUrl}${endpoint}`;
      console.log('[QloAppsClient] 📡 Making test request:');
      console.log(`[QloAppsClient]   Endpoint: ${endpoint}`);
      console.log(`[QloAppsClient]   Full URL: ${fullUrl}`);
      console.log(`[QloAppsClient]   Query params: display=full`);

      const requestStart = Date.now();
      const hotels = await this.makeRequest<any>(
        endpoint,
        { method: 'GET', query: { display: 'full' } }
      );
      const requestDuration = Date.now() - requestStart;
      const responseTimeMs = Date.now() - startTime;

      console.log(`[QloAppsClient] ✓ Request completed in ${requestDuration}ms`);
      console.log(`[QloAppsClient]   Response type: ${typeof hotels}`);
      console.log(`[QloAppsClient]   Response keys: ${hotels ? Object.keys(hotels).join(', ') : 'null'}`);

      // Extract hotel name if available
      let hotelName: string | undefined;
      if (hotels?.hotel?.hotel_name) {
        hotelName = hotels.hotel.hotel_name;
        console.log(`[QloAppsClient]   Found hotel name in hotels.hotel.hotel_name: ${hotelName}`);
      } else if (hotels?.hotels?.hotel?.[0]?.hotel_name) {
        hotelName = hotels.hotels.hotel[0].hotel_name;
        console.log(`[QloAppsClient]   Found hotel name in hotels.hotels.hotel[0].hotel_name: ${hotelName}`);
      } else {
        console.log('[QloAppsClient]   ⚠️  Hotel name not found in response structure');
        console.log(`[QloAppsClient]   Response structure:`, JSON.stringify(hotels, null, 2).substring(0, 500));
      }

      const result: QloAppsConnectionTestResult = {
        success: true,
        message: hotelName 
          ? `Successfully connected to QloApps (Hotel: ${hotelName})`
          : 'Successfully connected to QloApps',
        responseTimeMs,
      };
      
      if (hotelName) {
        result.hotelName = hotelName;
      }

      console.log(`[QloAppsClient] ✅ Connection test successful (${responseTimeMs}ms)`);
      return result;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      console.error(`[QloAppsClient] ❌ Connection test failed after ${responseTimeMs}ms`);

      // Provide helpful error messages
      if (error instanceof QloAppsError) {
        console.error(`[QloAppsClient]   Error type: QloAppsError`);
        console.error(`[QloAppsClient]   Status code: ${error.statusCode || 'N/A'}`);
        console.error(`[QloAppsClient]   Error code: ${error.code || 'N/A'}`);
        console.error(`[QloAppsClient]   Error message: ${error.message}`);
        
        let message = 'Connection failed';
        
        if (error.message.includes('401') || error.message.includes('Unauthorized') || error.statusCode === 401) {
          message = 'Invalid API key or credentials';
          console.error(`[QloAppsClient]   Diagnosis: Authentication failed - check API key`);
        } else if (error.message.includes('404') || error.message.includes('not found') || error.statusCode === 404) {
          message = 'Invalid hotel ID or endpoint not found';
          console.error(`[QloAppsClient]   Diagnosis: Resource not found - check hotel ID and base URL`);
        } else if (error.message.includes('ECONNREFUSED')) {
          message = 'Cannot reach QloApps server - check base URL';
          console.error(`[QloAppsClient]   Diagnosis: Network connectivity issue - server unreachable`);
        } else if (error.message.includes('timeout') || error instanceof QloAppsTimeoutError) {
          message = 'Connection timeout - server not responding';
          console.error(`[QloAppsClient]   Diagnosis: Request timed out after ${this.config.timeout}ms`);
        } else {
          message = `Connection failed: ${error.message}`;
          console.error(`[QloAppsClient]   Diagnosis: Unknown API error`);
        }

        return {
          success: false,
          message,
          error: error.message,
          responseTimeMs,
        };
      }

      console.error(`[QloAppsClient]   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`[QloAppsClient]   Error message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`[QloAppsClient]   Stack trace:`, error.stack);
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
  // Hotel Rooms API (Individual Room Instances)
  // ==========================================================================

  /**
   * Get hotel rooms (individual room instances like GR-101, GR-102)
   * @param params Filter parameters
   * @returns Array of hotel rooms
   */
  async getHotelRooms(params?: GetHotelRoomsParams): Promise<QloAppsRoom[]> {
    const query: Record<string, string | number | undefined> = {
      display: 'full',
    };

    if (params?.hotelId) {
      query['filter[id_hotel]'] = params.hotelId;
    }
    if (params?.productId) {
      query['filter[id_product]'] = params.productId;
    }
    if (params?.status !== undefined) {
      query['filter[id_status]'] = params.status;
    }
    if (params?.limit) {
      query.limit = params.limit;
    }
    if (params?.offset) {
      query.offset = params.offset;
    }

    const response = await this.makeRequest<{ rooms?: QloAppsRoom[] }>(
      QLOAPPS_CONFIG.ENDPOINTS.HOTEL_ROOMS,
      { method: 'GET', query }
    );

    return response.rooms || [];
  }

  /**
   * Get a specific hotel room by ID
   * @param id Hotel room ID
   * @returns Hotel room or null if not found
   */
  async getHotelRoom(id: number): Promise<QloAppsRoom | null> {
    try {
      const response = await this.makeRequest<{ room?: QloAppsRoom }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.HOTEL_ROOMS}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      return response.room || null;
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
   * Get bookings from QloApps using the room_bookings endpoint
   * @param params Filter parameters
   * @returns Array of bookings
   * 
   * Note: room_bookings endpoint has different filter fields than bookings endpoint:
   * - Use id_status instead of booking_status
   * - Use date_from/date_to for date range (no date_upd for modified since)
   * - Available filters: id, id_product, id_hotel, id_order, id_status, check_in, check_out, date_from, date_to, etc.
   * 
   * QloApps/PrestaShop filter syntax:
   * - EQUAL: filter[field]=value
   * - GREATER THAN: filter[field]=>[value]
   * - LOWER THAN: filter[field]=<[value]
   */
  async getBookings(params?: GetBookingsParams): Promise<QloAppsBooking[]> {
    const query: Record<string, string | number | undefined> = {
      display: 'full', // Always use full display to get complete entity data
    };

    if (params?.hotelId) {
      query['filter[id_hotel]'] = params.hotelId;
    }
    
    // room_bookings uses id_status instead of booking_status
    if (params?.bookingStatus !== undefined) {
      query['filter[id_status]'] = params.bookingStatus;
    }
    
    // Use GREATER THAN (>) and LOWER THAN (<) operators with bracket syntax
    // Note: Values inside brackets are automatically URL-encoded by URLSearchParams
    if (params?.dateFrom) {
      query['filter[date_from]'] = `>[${params.dateFrom}]`;
    }
    if (params?.dateTo) {
      query['filter[date_to]'] = `<[${params.dateTo}]`;
    }
    
    // Note: room_bookings doesn't have date_upd field for modified since
    // For incremental sync, we need to use check_in date as a proxy
    if (params?.modifiedSince) {
      // Use check_in date as filter since there's no date_upd
      // modifiedSince is ISO 8601 string, extract date part (YYYY-MM-DD)
      const dateFilter = params.modifiedSince.split('T')[0];
      query['filter[check_in]'] = `>[${dateFilter}]`;
    }
    
    if (params?.limit) {
      query.limit = `${params.offset || 0},${params.limit}`;
    }

    // Log the query being sent for debugging
    this.log(`[QloAppsClient] getBookings query: ${JSON.stringify(query)}`);
    console.log(`[QloAppsClient] Fetching bookings with filters:`, query);

    // Use room_bookings endpoint instead of bookings for complete data
    let response;
    try {
      response = await this.makeRequest<{
        bookings?: QloAppsBookingRaw[]; // room_bookings endpoint returns "bookings" key
      }>(
        QLOAPPS_CONFIG.ENDPOINTS.ROOM_BOOKINGS,
        { method: 'GET', query }
      );
    } catch (error) {
      // If query with filters fails, try with minimal filters
      if (error instanceof QloAppsError && error.statusCode === 500) {
        console.warn(`[QloAppsClient] Initial query failed with 500, retrying with minimal filters...`);
        const minimalQuery: Record<string, string | number | undefined> = {
          display: 'full',
        };
        if (params?.hotelId) {
          minimalQuery['filter[id_hotel]'] = params.hotelId;
        }
        if (params?.limit) {
          minimalQuery.limit = `${params.offset || 0},${params.limit}`;
        }

        console.log(`[QloAppsClient] Retrying with minimal query:`, minimalQuery);
        response = await this.makeRequest<{
          bookings?: QloAppsBookingRaw[];
        }>(
          QLOAPPS_CONFIG.ENDPOINTS.ROOM_BOOKINGS,
          { method: 'GET', query: minimalQuery }
        );
      } else {
        throw error;
      }
    }

    // room_bookings endpoint returns "bookings" key
    const rawBookings = response.bookings || [];
    
    // Log first raw booking structure for debugging
    if (rawBookings.length > 0 && this.debug) {
      const firstBooking = rawBookings[0] as any; // Type assertion for debug logging
      console.log('[QloAppsClient] Raw booking structure from API:', {
        id: firstBooking?.id,
        keys: Object.keys(firstBooking || {}),
        has_associations: !!firstBooking?.associations,
        associations_keys: firstBooking?.associations ? Object.keys(firstBooking.associations) : [],
        endpoint: QLOAPPS_CONFIG.ENDPOINTS.ROOM_BOOKINGS,
      });
    }
    
    // Normalize bookings from PrestaShop associations structure
    const bookings = rawBookings.map(raw => normalizeQloAppsBooking(raw));
    
    // Log normalized structure
    if (bookings.length > 0 && this.debug) {
      console.log('[QloAppsClient] Normalized booking structure:', {
        id: bookings[0]?.id,
        has_room_types: !!bookings[0]?.room_types,
        room_types_count: bookings[0]?.room_types?.length || 0,
        has_customer_detail: !!bookings[0]?.customer_detail,
      });
    }
    
    return bookings;
  }

  /**
   * Get a specific booking by ID using the room_bookings endpoint
   * @param id Booking ID
   * @returns Booking or null if not found
   */
  async getBooking(id: number): Promise<QloAppsBooking | null> {
    try {
      const response = await this.makeRequest<{
        booking?: QloAppsBookingRaw; // room_bookings endpoint returns "booking" key for single items
      }>(
        `${QLOAPPS_CONFIG.ENDPOINTS.ROOM_BOOKINGS}/${id}`,
        { method: 'GET', query: { display: 'full' } }
      );

      const rawBooking = response.booking;
      if (!rawBooking) {
        return null;
      }

      // Normalize booking from room_bookings flat structure
      return normalizeQloAppsBooking(rawBooking);
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
    console.log(`[QloAppsClient] 📨 makeRequest called for endpoint: ${endpoint}`);
    
    // Check circuit breaker
    const canProceed = this.circuitBreaker.canProceed();
    console.log(`[QloAppsClient]   Circuit breaker check: ${canProceed ? '✓ Can proceed' : '✗ Blocked'}`);
    console.log(`[QloAppsClient]   Circuit breaker state: ${this.circuitBreaker.getState()}`);
    
    if (!canProceed) {
      const openedAt = this.circuitBreaker.getOpenedAt();
      const resetAt = this.circuitBreaker.getResetAt();
      console.error(`[QloAppsClient] ❌ Circuit breaker is OPEN`);
      console.error(`[QloAppsClient]   Opened at: ${openedAt?.toISOString() || 'N/A'}`);
      console.error(`[QloAppsClient]   Reset at: ${resetAt?.toISOString() || 'N/A'}`);
      throw new QloAppsCircuitBreakerError(
        'QloApps circuit breaker is open. Too many consecutive failures.',
        openedAt || undefined,
        resetAt || undefined
      );
    }

    // Check rate limit
    if (!options.skipRateLimit) {
      const rateLimitCheck = this.rateLimiter.tryConsume();
      console.log(`[QloAppsClient]   Rate limit check: ${rateLimitCheck ? '✓ Token consumed' : '✗ Rate limited'}`);
      
      if (!rateLimitCheck) {
        const waitTime = this.rateLimiter.getTimeUntilNextToken();
        console.error(`[QloAppsClient] ❌ Rate limit exceeded, wait ${Math.ceil(waitTime / 1000)}s`);
        throw new QloAppsRateLimitError(
          `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
          waitTime
        );
      }
    } else {
      console.log(`[QloAppsClient]   Rate limit check: Skipped (skipRateLimit=true)`);
    }

    let lastError: Error | undefined;
    const maxRetries = QLOAPPS_CONFIG.MAX_RETRIES;
    console.log(`[QloAppsClient]   Max retries: ${maxRetries}`);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.log(`[QloAppsClient] 🔄 Attempt ${attempt + 1}/${maxRetries + 1}`);
      
      try {
        const result = await this.executeRequest<T>(endpoint, options);
        console.log(`[QloAppsClient] ✅ Request succeeded on attempt ${attempt + 1}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[QloAppsClient] ❌ Attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry on certain errors
        if (error instanceof QloAppsAuthenticationError) {
          console.error(`[QloAppsClient]   Authentication error - not retrying`);
          this.circuitBreaker.recordFailure();
          throw error;
        }

        if (error instanceof QloAppsRateLimitError) {
          console.log(`[QloAppsClient]   Rate limit error`);
          // Wait for rate limit to reset and retry
          if (error.retryAfter && attempt < maxRetries) {
            console.log(`[QloAppsClient]   Waiting ${error.retryAfter}ms before retry...`);
            await this.sleep(error.retryAfter);
            continue;
          }
          console.error(`[QloAppsClient]   Max retries reached for rate limit`);
          throw error;
        }

        // Record failure for circuit breaker
        if (
          error instanceof QloAppsError &&
          error.statusCode !== undefined &&
          error.statusCode >= 500
        ) {
          console.log(`[QloAppsClient]   Recording server error (${error.statusCode}) to circuit breaker`);
          this.circuitBreaker.recordFailure();
        }

        // Retry with exponential backoff for retryable errors
        const isRetryable = error instanceof QloAppsError && this.isRetryableError(error);
        console.log(`[QloAppsClient]   Error is retryable: ${isRetryable}`);
        console.log(`[QloAppsClient]   Attempts remaining: ${maxRetries - attempt}`);
        
        if (
          attempt < maxRetries &&
          isRetryable
        ) {
          const delay = Math.min(
            QLOAPPS_CONFIG.RETRY_INITIAL_DELAY_MS *
              Math.pow(QLOAPPS_CONFIG.RETRY_BACKOFF_MULTIPLIER, attempt),
            QLOAPPS_CONFIG.RETRY_MAX_DELAY_MS
          );

          console.log(`[QloAppsClient]   Retrying after ${delay}ms (exponential backoff)`);
          this.log(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        console.error(`[QloAppsClient]   Not retrying - throwing error`);
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
    const requestStart = Date.now();
    const url = `${this.config.baseUrl}${endpoint}`;
    const method = options.method || 'GET';

    console.log(`[QloAppsClient] 🔧 Building request:`);
    console.log(`[QloAppsClient]   Base URL: ${this.config.baseUrl}`);
    console.log(`[QloAppsClient]   Endpoint: ${endpoint}`);
    console.log(`[QloAppsClient]   Method: ${method}`);

    // Build headers
    const headers: Record<string, string> = {
      Authorization: `Basic ${this.encodeBasicAuth(this.config.apiKey, '')}`,
      [QLOAPPS_CONFIG.HEADERS.OUTPUT_FORMAT]: 'JSON',
      ...options.headers,
    };

    console.log(`[QloAppsClient]   Headers:`);
    console.log(`[QloAppsClient]     Authorization: Basic ${this.config.apiKey.substring(0, 8)}...`);
    console.log(`[QloAppsClient]     ${QLOAPPS_CONFIG.HEADERS.OUTPUT_FORMAT}: ${headers[QLOAPPS_CONFIG.HEADERS.OUTPUT_FORMAT]}`);

    // Add Content-Type for requests with body
    if (options.body) {
      headers[QLOAPPS_CONFIG.HEADERS.CONTENT_TYPE] = 'application/json';
      console.log(`[QloAppsClient]     Content-Type: ${headers[QLOAPPS_CONFIG.HEADERS.CONTENT_TYPE]}`);
    }

    // Build query string
    let fullUrl = url;
    if (options.query) {
      console.log(`[QloAppsClient]   Query parameters:`, options.query);
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
      console.log(`[QloAppsClient]   Query string: ${queryString}`);
    }

    console.log(`[QloAppsClient]   Full URL: ${fullUrl}`);
    this.log(`${method} ${fullUrl}`);

    try {
      const controller = new AbortController();
      const timeoutMs = options.timeout || this.config.timeout || QLOAPPS_CONFIG.DEFAULT_TIMEOUT_MS;
      console.log(`[QloAppsClient]   Timeout: ${timeoutMs}ms`);
      const timeoutId = setTimeout(() => {
        console.error(`[QloAppsClient] ⏱️  Request timeout after ${timeoutMs}ms`);
        controller.abort();
      }, timeoutMs);

      const requestBody = options.body ? JSON.stringify(options.body) : null;
      if (requestBody) {
        console.log(`[QloAppsClient]   Request body: ${requestBody.substring(0, 200)}...`);
      }
      
      console.log(`[QloAppsClient] 📡 Sending HTTP ${method} request...`);
      const fetchStart = Date.now();
      const response = await fetch(fullUrl, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      const fetchDuration = Date.now() - fetchStart;
      clearTimeout(timeoutId);

      console.log(`[QloAppsClient] ✓ Response received in ${fetchDuration}ms`);
      console.log(`[QloAppsClient]   Status: ${response.status} ${response.statusText}`);
      console.log(`[QloAppsClient]   Headers:`, Object.fromEntries(response.headers.entries()));

      // Handle non-2xx responses
      if (!response.ok) {
        console.error(`[QloAppsClient] ❌ Non-OK response received`);
        const errorData = await this.parseErrorResponse(response);
        
        // Enhanced error logging for debugging
        console.error(`[QloAppsClient] API Error Response:`);
        console.error(`[QloAppsClient]   URL: ${fullUrl}`);
        console.error(`[QloAppsClient]   Status: ${response.status} ${response.statusText}`);
        console.error(`[QloAppsClient]   Error Data:`, JSON.stringify(errorData, null, 2));
        
        const error = createQloAppsError(response.status, errorData);
        throw error;
      }

      // Record success
      this.circuitBreaker.recordSuccess();
      console.log(`[QloAppsClient] ✓ Circuit breaker recorded success`);

      // Parse response
      console.log(`[QloAppsClient] 📄 Reading response body...`);
      const textStart = Date.now();
      const text = await response.text();
      const textDuration = Date.now() - textStart;
      console.log(`[QloAppsClient]   Response body read in ${textDuration}ms`);
      console.log(`[QloAppsClient]   Response length: ${text.length} characters`);
      console.log(`[QloAppsClient]   Response preview: ${text.substring(0, 200)}...`);

      if (!text) {
        console.warn(`[QloAppsClient] ⚠️  Empty response body`);
        return {} as T;
      }

      try {
        console.log(`[QloAppsClient] 🔄 Parsing JSON response...`);
        const parseStart = Date.now();
        const parsed = JSON.parse(text) as T;
        const parseDuration = Date.now() - parseStart;
        console.log(`[QloAppsClient] ✓ JSON parsed successfully in ${parseDuration}ms`);
        console.log(`[QloAppsClient]   Parsed keys: ${parsed && typeof parsed === 'object' ? Object.keys(parsed).join(', ') : 'N/A'}`);
        const totalDuration = Date.now() - requestStart;
        console.log(`[QloAppsClient] ✅ Request completed successfully in ${totalDuration}ms`);
        return parsed;
      } catch (parseError) {
        // QloApps might return XML, try to handle it
        console.error(`[QloAppsClient] ❌ Failed to parse JSON response`);
        console.error(`[QloAppsClient]   Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        console.error(`[QloAppsClient]   Response preview: ${text.substring(0, 500)}`);
        this.log(`Warning: Response is not valid JSON: ${text.substring(0, 200)}`);
        throw new QloAppsError(
          QLOAPPS_CONFIG.ERROR_CODES.API_ERROR,
          'Invalid JSON response from QloApps'
        );
      }
    } catch (error) {
      const totalDuration = Date.now() - requestStart;
      console.error(`[QloAppsClient] ❌ Request failed after ${totalDuration}ms`);
      
      // Handle network errors
      if (error instanceof QloAppsError) {
        console.error(`[QloAppsClient]   Error is QloAppsError: ${error.code}`);
        throw error;
      }

      if (error instanceof Error) {
        console.error(`[QloAppsClient]   Error name: ${error.name}`);
        console.error(`[QloAppsClient]   Error message: ${error.message}`);
        if (error.stack) {
          console.error(`[QloAppsClient]   Stack trace:`, error.stack);
        }
        
        if (error.name === 'AbortError') {
          console.error(`[QloAppsClient]   Request was aborted (timeout)`);
          throw new QloAppsTimeoutError(
            this.config.timeout || QLOAPPS_CONFIG.DEFAULT_TIMEOUT_MS,
            error
          );
        }
        
        // Check for common network errors
        if (error.message.includes('ECONNREFUSED')) {
          console.error(`[QloAppsClient]   Connection refused - server not reachable`);
        } else if (error.message.includes('ENOTFOUND')) {
          console.error(`[QloAppsClient]   DNS lookup failed - hostname not found`);
        } else if (error.message.includes('ETIMEDOUT')) {
          console.error(`[QloAppsClient]   Connection timed out`);
        }
        
        throw new QloAppsNetworkError(`Network error: ${error.message}`, error);
      }

      console.error(`[QloAppsClient]   Unknown error type: ${typeof error}`);
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
