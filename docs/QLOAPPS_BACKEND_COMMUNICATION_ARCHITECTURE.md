# QloApps Backend Communication Architecture

A comprehensive guide to how the hotel management backend communicates with the QloApps PMS system.

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [HTTP Client Layer](#http-client-layer)
4. [Message Queue Layer](#message-queue-layer)
5. [Worker Layer](#worker-layer)
6. [Data Flow Patterns](#data-flow-patterns)
7. [Resilience Mechanisms](#resilience-mechanisms)
8. [API Endpoint Reference](#api-endpoint-reference)

---

## Overview

The QloApps integration uses a **multi-layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (React)                          │
│              (SettingsPage.jsx, API client)                │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Backend API Server (Express.js)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Channel Manager Service (Facade)                   │  │
│  │  - getStatus() → fetches from DB                    │  │
│  │  - testConnection() → uses QloAppsClient            │  │
│  │  - switch() → updates DB active_channel_manager    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌──────────────┐       ┌──────────────┐
    │ RabbitMQ     │       │ PostgreSQL   │
    │ Message Queue│       │ Database     │
    └──────────────┘       └──────────────┘
         │                       ▲
         │ (async jobs)          │
         ▼                       │
    ┌──────────────────────────────────────┐
    │  Worker Processes                    │
    │  - Outbound Worker                   │
    │  - Inbound Worker                    │
    │  - Sync Scheduler                    │
    │                                      │
    │  (consume messages, process data)    │
    └────────────┬──────────────┬──────────┘
                 │              │
                 │ HTTP         │ stores/reads
                 ▼              │
            ┌─────────────────┐ │
            │ QloApps Client  │─┘
            │ (HTTP layer)    │
            └────────┬────────┘
                     │ HTTP
                     ▼
            ┌──────────────────────────┐
            │  QloApps PMS API         │
            │  http://localhost:8080   │
            └──────────────────────────┘
```

---

## Core Architecture

### Layer 1: HTTP Client (qloapps_client.ts)

The foundation layer that handles all direct communication with QloApps.

**Responsibilities:**
- HTTP request/response handling
- Authentication (Basic Auth with API key)
- Rate limiting (token bucket algorithm)
- Circuit breaker pattern (fault tolerance)
- Retry logic with exponential backoff
- Request timeouts
- Error handling and mapping

**Key Classes:**

```typescript
// Rate Limiter (token bucket algorithm)
class RateLimiter {
  constructor(tokensPerWindow: number, windowMs: number)
  async acquireToken(): Promise<void>
}

// Circuit Breaker (3-state pattern)
class CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureThreshold: number
  cooldownMs: number
  async execute<T>(fn: () => Promise<T>): Promise<T>
}

// Main QloApps Client
class QloAppsClient {
  async testConnection(): Promise<void>
  async getBookings(params): Promise<QloAppsBooking[]>
  async createBooking(booking): Promise<number>
  async updateBooking(id, booking): Promise<void>
  async cancelBooking(id): Promise<void>
  async getCustomers(params): Promise<QloAppsCustomer[]>
  async getRoomTypes(): Promise<QloAppsRoomType[]>
  async getAvailability(roomTypeId, params): Promise<object>
  async updateAvailability(roomTypeId, data): Promise<void>
}
```

### Layer 2: Service Layer

High-level services that orchestrate QloApps operations using the HTTP client.

**Main Services:**

1. **Push Sync Service** (`push_sync_service.ts`)
   - Pushes PMS reservations → QloApps bookings
   - Handles create/update operations
   - Maps PMS schema to QloApps schema

2. **Pull Sync Service** (`pull_sync_service.ts`)
   - Fetches QloApps bookings → PMS reservations
   - Handles incremental and full syncs
   - Guest matching and deduplication

3. **Availability Sync Service** (`availability_sync_service.ts`)
   - Syncs room availability to QloApps
   - Handles date-range operations

4. **Rate Sync Service** (`rate_sync_service.ts`)
   - Syncs room rates to QloApps
   - Handles rate plan management

### Layer 3: Message Queue (RabbitMQ)

Decouples sync operations from synchronous requests.

**Queues:**
- `qloapps.outbound` - Events to send to QloApps
- `qloapps.inbound` - Events to receive from QloApps

**Queue Base Consumer:**
```typescript
class QloAppsBaseConsumer {
  abstract async processMessage(context): Promise<void>
  prefetch: number          // Number of messages to prefetch
  maxRetries: number        // Retry attempts on failure
  retryDelayMs: number      // Delay between retries
}
```

### Layer 4: Worker Layer

Background processes that consume messages and perform sync operations.

**Workers:**

1. **Outbound Worker** (`outbound_worker.ts`)
   - Consumes: `qloapps.outbound` queue
   - Handles: Create/update reservations, availability, rates
   - Events: `reservation.create`, `reservation.update`, `reservation.cancel`, `availability.update`, `rate.update`

2. **Inbound Worker** (`inbound_worker.ts`)
   - Consumes: `qloapps.inbound` queue
   - Handles: Sync bookings from QloApps to PMS
   - Events: `booking.sync`, `booking.created`, `booking.updated`, `booking.cancelled`

3. **Sync Scheduler** (`sync_scheduler.ts`)
   - Runs on configurable interval (default: 5 minutes)
   - Performs incremental pulls from QloApps
   - Implements database-level locking to prevent overlapping syncs
   - Tracks sync state and statistics

---

## HTTP Client Layer

### Authentication

QloApps uses **Basic Authentication** with API key as username:

```typescript
// Construction
const client = new QloAppsClient({
  baseUrl: 'http://localhost:8080',
  apiKey: 'your-api-key-here',
  hotelId: 123,
});

// HTTP Header
Authorization: Basic ${base64(`${apiKey}:`)}
// Example: Authorization: Basic YWJjMTIzOjo=
```

### Request/Response Flow

```
User Request
    ↓
Frontend API Client
    ↓ HTTP
Backend Controller
    ↓
Service Layer
    ↓
Message Queue (RabbitMQ)
    ↓ (async)
Worker Process
    ↓
QloAppsClient.executeRequest()
    ├─ Rate Limiter Check
    ├─ Circuit Breaker Check
    ├─ Retry Logic (max 3 attempts)
    ├─ Build Headers + URL
    ├─ Fetch with Timeout (30s)
    └─ Error Mapping
    ↓
QloApps API
    ↓
Response → mapped to PMS schema
    ↓
Database Update
    ↓
Sync State Recorded
```

### Rate Limiting

**Token Bucket Algorithm:**
- **Tokens per Window**: 100
- **Window Duration**: 60 seconds
- **Behavior**: Tokens regenerate continuously

```typescript
// Acquires token before each request
// Blocks if no tokens available until regeneration
async acquireToken(): Promise<void>
  if (tokens >= 1) {
    tokens--
    return immediately
  } else {
    wait until token regenerates
  }
```

**Use Case:** Prevents overwhelming QloApps API when handling burst requests.

### Circuit Breaker Pattern

**States:**
1. **CLOSED** (Normal) → Requests flow through
2. **OPEN** (Fault) → Requests rejected immediately, fast fail
3. **HALF_OPEN** (Recovery) → Limited requests allowed to test recovery

**Transition Logic:**

```
CLOSED ──(failures ≥ threshold)──> OPEN
  ▲                                   │
  └─(success in HALF_OPEN)            │
                            (cooldown expired)
                                      ↓
                               HALF_OPEN
                                      │
                    (failure)──> OPEN (reset cooldown)
                    (success)──> CLOSED
```

**Configuration:**
- **Failure Threshold**: 5 consecutive failures
- **Cooldown**: 30 seconds before trying HALF_OPEN
- **Max Requests in HALF_OPEN**: 1

### Retry Logic with Exponential Backoff

Applied when requests fail (network errors, timeouts, 5xx errors):

```typescript
// Initial delay: 500ms
// Multiplier: 2x
// Max delay: 30 seconds
// Max retries: 3 attempts

Attempt 1: immediate failure
Attempt 2: wait 500ms, retry
Attempt 3: wait 1000ms (500 * 2), retry
Attempt 4: wait 2000ms (1000 * 2), retry, then give up
```

**Errors that Trigger Retry:**
- Network timeouts
- HTTP 408 (Request Timeout)
- HTTP 429 (Too Many Requests)
- HTTP 5xx (Server errors)
- Connection refused
- DNS resolution failures

---

## Message Queue Layer

### Queue Topology

```typescript
// Topology configuration
const QLOAPPS_QUEUE_NAMES = {
  OUTBOUND: 'qloapps.outbound',
  INBOUND: 'qloapps.inbound',
};

// Queue settings
{
  durable: true,              // Survives broker restart
  maxLength: 10000,           // Max messages in queue
  messageTtl: 24 * 60 * 60 * 1000,  // 24 hours expiry
}
```

### Message Format

**Outbound Messages:**

```typescript
// Reservation events
interface QloAppsOutboundReservationMessage {
  eventType: 'reservation.create' | 'reservation.update' | 'reservation.cancel',
  configId: string,
  reservationId: string,
  timestamp: Date,
}

// Availability events
interface QloAppsOutboundAvailabilityMessage {
  eventType: 'availability.update',
  configId: string,
  roomTypeId: string,
  dateFrom: string,     // YYYY-MM-DD
  dateTo: string,       // YYYY-MM-DD
  timestamp: Date,
}

// Rate events
interface QloAppsOutboundRateMessage {
  eventType: 'rate.update',
  configId: string,
  roomTypeId: string,
  dateFrom: string,
  dateTo: string,
  timestamp: Date,
}
```

**Inbound Messages:**

```typescript
interface QloAppsInboundMessage {
  eventType: 'booking.sync' | 'booking.created' | 'booking.updated' | 'booking.cancelled',
  configId: string,
  syncType?: 'full' | 'incremental',
  qloAppsBookingId?: number,
  timestamp: Date,
}
```

### Consumer Configuration

```typescript
{
  prefetch: 1,              // Process one message at a time
  maxRetries: 3,            // Retry failed messages 3 times
  retryDelayMs: 2000,       // Wait 2 seconds between retries
}
```

---

## Worker Layer

### Outbound Worker Flow

Processes events to push data from PMS to QloApps:

```
Message: reservation.create
    ↓
1. Get QloApps config from DB
   (base_url, api_key, hotel_id)
    ↓
2. Create QloAppsClient instance
    ↓
3. Create PushSyncService
    ↓
4. Get reservations to sync
   (filtered by ID from message)
    ↓
5. Validate against QloApps schema
    ↓
6. Map PMS reservation → QloApps booking
    ├─ Check-in date
    ├─ Check-out date
    ├─ Guest information
    ├─ Room assignment
    ├─ Price/total
    └─ Status
    ↓
7. Call QloAppsClient.createBooking()
    ├─ Rate limit check
    ├─ Circuit breaker check
    ├─ HTTP POST to /bookings
    ├─ Retry on failure
    └─ Timeout after 30s
    ↓
8. Store mapping
   (local_reservation_id ↔ qloapps_booking_id)
    ↓
9. Record sync state in DB
    └─ syncType: 'reservation_push'
    └─ direction: 'outbound'
    └─ success: true/false
    └─ timestamp
    ↓
10. Acknowledge message to queue
    or retry on error
```

**Error Handling:**

```typescript
try {
  // Process message
  const results = await pushService.pushReservations(reservations)
  
  if (!result.success) {
    throw new Error(`Failed to push: ${result.error}`)
  }
  
  // Log sync
  await this.logSync({
    configId,
    syncType: 'reservation_push',
    success: true,
    operation: 'create',
    localEntityId: reservationId,
    qloAppsEntityId: result.qloAppsBookingId,
  })
} catch (error) {
  // Worker retries (up to 3 times)
  // After max retries, message is dead-lettered
  throw error  // Triggers retry
}
```

### Inbound Worker Flow

Processes events to pull bookings from QloApps:

```
Message: booking.sync (incremental)
    ↓
1. Get QloApps config from DB
    ↓
2. Create QloAppsClient instance
    ↓
3. Create PullSyncService
    ↓
4. Determine sync type
   ├─ Full: fetch all bookings since beginning
   └─ Incremental: fetch only modified since last_synced_at
    ↓
5. Call QloAppsClient.getBookings()
   (with modifiedSince filter if incremental)
    ├─ Rate limit check
    ├─ Circuit breaker check
    ├─ HTTP GET to /bookings?modifiedSince=...
    ├─ Retry on failure
    └─ Timeout after 30s
    ↓
6. Validate each booking
   (required fields, data integrity)
    ↓
7. For each booking:
    ├─ Check if already mapped
    ├─ Match guest to PMS
    │  (by email, phone, name)
    ├─ Handle duplicates
    ├─ Map QloApps booking → PMS reservation
    │  ├─ Check-in date
    │  ├─ Check-out date
    │  ├─ Guest info
    │  ├─ Room assignment
    │  └─ Price
    ├─ Create/update PMS reservation
    └─ Store mapping
    │  (qloapps_booking_id ↔ local_reservation_id)
    │
8. Record sync state
    ├─ itemsProcessed
    ├─ itemsCreated
    ├─ itemsUpdated
    ├─ itemsFailed
    └─ timestamp
    ↓
9. Acknowledge message to queue
```

**Guest Matching:**

```typescript
// Attempts to find matching guest in PMS
// Priority order:
1. By email (exact match, case-insensitive)
2. By phone (exact match, normalized)
3. By name + check-in date (fuzzy match)

// If no match found:
→ Create new guest in PMS
→ Track as potential duplicate
```

### Sync Scheduler Flow

Runs on interval (default: 5 minutes) to continuously pull bookings:

```
┌─────────────────────────────────────┐
│  Sync Scheduler Main Loop           │
│  (runs every 5 minutes)             │
└────────┬────────────────────────────┘
         │
    ┌────▼──────────────────┐
    │ For each config:      │
    │ (multi-property)      │
    └────┬─────────────────┘
         │
    1. Attempt to acquire lock
       (prevent overlapping syncs)
         │
         ├─ If locked → skip this config
         │
         └─ If acquired → continue
         │
    2. Determine sync type
       ├─ If last_synced_at exists:
       │  → Incremental (since last_synced_at)
       │
       └─ If first sync:
          → Full sync (all bookings)
         │
    3. Create PullSyncService
         │
    4. Call pullBookings()
       (fetches from QloApps)
         │
    5. Sync to PMS
       (creates/updates reservations)
         │
    6. Record statistics
       ├─ itemsProcessed
       ├─ itemsCreated
       ├─ itemsUpdated
       ├─ itemsFailed
       └─ durationMs
         │
    7. Release lock
         │
    8. Update sync state
       ├─ last_successful_sync
       └─ last_sync_error
         │
    ▼
On Error:
  → Implement exponential backoff
  → Backoff: 1min → 2min → 4min → max 15min
  → Retry at next interval with longer wait
```

**Lock Mechanism:**

```typescript
// Database-level lock
table: qloapps_sync_state
columns:
  - id (UUID)
  - sync_type (e.g., 'qloapps_pull_config-123')
  - status ('running' | 'completed' | 'failed')
  - started_at (timestamp)
  - completed_at (timestamp)
  - items_processed (count)
  - items_created (count)
  - items_updated (count)
  - items_failed (count)
  - duration_ms (milliseconds)
  - error_message (string)

// Lock acquisition:
// 1. Check if any 'running' sync exists AND started < 10min ago
// 2. If yes → already running, skip
// 3. If no → mark as 'running', get UUID
// 4. Release when done → update status + stats
```

---

## Data Flow Patterns

### Pattern 1: Frontend Initiates Manual Push

User clicks "Save" in a form to update a reservation:

```
Frontend (SettingsPage.jsx)
    │
    ├─ User action triggers API call
    ├─ POST /api/v1/settings/channel-managers/test
    │
    ▼
Backend Controller (settings_controller.ts)
    │
    ├─ Receives request
    ├─ Calls channelManagerService.testConnection()
    │
    ▼
Channel Manager Service
    │
    ├─ Gets active_channel_manager from DB
    ├─ If 'qloapps':
    │  └─ Creates QloAppsClient
    │  └─ Calls client.testConnection()
    │
    ▼
QloAppsClient
    │
    ├─ Rate limiter check
    ├─ Circuit breaker check
    ├─ HTTP GET to /api (root endpoint)
    ├─ Validates response
    │
    ▼
Response → Frontend
    │
    └─ Show "Connected ✓" or error
```

### Pattern 2: Async Reservation Sync

A reservation is created/updated in PMS:

```
1. PMS Application Layer
   │
   ├─ Reservation created
   └─ Publish event to queue
   │
   ├─ Event type: 'reservation.create'
   ├─ Config ID: 'config-123'
   ├─ Reservation ID: 'res-456'
   │
   ▼
2. RabbitMQ Queue
   │
   ├─ Message: qloapps.outbound
   └─ Status: pending
   │
   ▼
3. Outbound Worker (polling qloapps.outbound)
   │
   ├─ Receives message
   ├─ Validates message format
   ├─ Loads config from DB
   │
   ▼
4. Creates QloAppsClient
   │
   ├─ Base URL: http://localhost:8080
   ├─ API Key: (from encrypted DB)
   ├─ Hotel ID: (from config)
   │
   ▼
5. PushSyncService.pushReservations()
   │
   ├─ Loads reservation from PMS DB
   ├─ Validates schema
   ├─ Maps PMS → QloApps format
   │  ├─ guest name → firstname, lastname
   │  ├─ check_in → dateFrom
   │  ├─ check_out → dateTo
   │  ├─ room_id → room assignment
   │  └─ total_price → totalPrice
   │
   ▼
6. QloAppsClient.createBooking()
   │
   ├─ Rate limiter: acquireToken()
   ├─ Circuit breaker: check state
   │  ├─ If OPEN → throw FastFailError
   │  ├─ If CLOSED/HALF_OPEN → proceed
   │
   ├─ Build request:
   │  ├─ URL: http://localhost:8080/api/?io_format=JSON&action=bookings&operation=add
   │  ├─ Method: POST
   │  ├─ Headers:
   │  │  ├─ Authorization: Basic [base64(apiKey:)]
   │  │  ├─ Content-Type: application/json
   │  │  └─ User-Agent: HotelPMS/1.0
   │  │
   │  └─ Body: { ... QloApps booking object ... }
   │
   ├─ Fetch with timeout (30s)
   │  └─ AbortController cancels if timeout
   │
   ├─ Retry logic (max 3 attempts):
   │  ├─ Attempt 1: try immediately
   │  ├─ Attempt 2: wait 500ms, retry
   │  ├─ Attempt 3: wait 1000ms, retry
   │  └─ If all fail: throw error
   │
   ▼
7. QloApps API Response
   │
   ├─ Success: { id: 789, status: 'confirmed' }
   │         → Save mapping: res-456 ↔ booking-789
   │         → Record sync: 'reservation_push', 'outbound', 'create', success=true
   │
   └─ Error: Circuit breaker opens
                  ↓ (if threshold reached)
            → Retry message later
            → Next attempt: circuit breaker HALF_OPEN
            → If recovery: CLOSED
            → If still failing: stay OPEN, fast fail
```

### Pattern 3: Scheduled Pull Sync

Sync scheduler runs every 5 minutes:

```
1. Sync Scheduler Timer Fires
   │
   ├─ Every 5 minutes
   └─ Configured via: QLOAPPS_SYNC_INTERVAL_MS
   │
   ▼
2. For Each Active Config
   │
   ├─ Try to acquire lock: sync_type = 'qloapps_pull_config-123'
   ├─ If lock acquired:
   │  └─ Proceed to sync
   │
   └─ If locked:
      └─ Skip (another sync running)
   │
   ▼
3. Check Last Sync Timestamp
   │
   ├─ Query: qloapps_sync_state WHERE sync_type = '...'
   ├─ If last_successful_sync exists:
   │  └─ Sync type: 'incremental'
   │  └─ modifiedSince: last_successful_sync
   │
   └─ If first time:
      └─ Sync type: 'full'
      └─ modifiedSince: null (fetch all)
   │
   ▼
4. QloAppsClient.getBookings()
   │
   ├─ Build URL:
   │  └─ http://localhost:8080/api/?io_format=JSON&action=bookings&modifiedSince=2024-01-15T10:30:00Z
   │
   ├─ Rate limiter: acquireToken()
   ├─ Circuit breaker: check state
   │
   ├─ HTTP GET request
   │  └─ Timeout: 30 seconds
   │
   ├─ Retry on error (max 3 times)
   │  ├─ 500ms backoff
   │  ├─ 1000ms backoff
   │  └─ 2000ms backoff
   │
   ▼
5. QloApps Response
   │
   ├─ Array of bookings: [{ id, firstname, lastname, ... }, ...]
   └─ Timestamp: 2024-01-15T10:35:00Z
   │
   ▼
6. PullSyncService.syncBookingsToPms()
   │
   ├─ For each booking:
   │  ├─ Validate schema
   │  ├─ Check if already synced (mapping exists)
   │  ├─ Match guest (email → phone → name)
   │  ├─ Create/update PMS reservation
   │  ├─ Store mapping: booking-789 ↔ res-456
   │  │
   │  └─ Result:
   │     ├─ { success: true, action: 'created' }
   │     ├─ { success: true, action: 'updated' }
   │     ├─ { success: true, action: 'skipped' }
   │     └─ { success: false, action: 'failed', error: '...' }
   │
   ▼
7. Record Sync Statistics
   │
   ├─ itemsProcessed: 15
   ├─ itemsCreated: 3
   ├─ itemsUpdated: 10
   ├─ itemsFailed: 2
   ├─ durationMs: 1234
   │
   ▼
8. Update Sync State
   │
   ├─ status: 'completed'
   ├─ completed_at: now
   ├─ last_successful_sync: now
   ├─ Release lock
   │
   └─ Retry count reset to 0
   │
   ▼
9. Next Sync in 5 Minutes
   │
   └─ Timer fires again
      (use incremental sync with new modifiedSince)
```

---

## Resilience Mechanisms

### 1. Circuit Breaker Recovery Example

```
Timeline:
─────────────────────────────────────────────────────────────

T+0s: CLOSED (normal)
     ├─ Request 1: SUCCESS ✓
     ├─ Request 2: SUCCESS ✓
     └─ Request 3: SUCCESS ✓

T+5s: QloApps goes down

T+6s: CLOSED → OPEN (failures ≥ 5)
     ├─ Request 4: FAIL ✗
     ├─ Request 5: FAIL ✗
     ├─ Request 6: FAIL ✗
     ├─ Request 7: FAIL ✗
     └─ Request 8: FAIL ✗
        (now failure count = 5)
        → State changes to OPEN

T+7s: OPEN (fast fail)
     ├─ Request 9: REJECTED ✗ (fast fail, no HTTP call)
     ├─ Request 10: REJECTED ✗ (fast fail)
     └─ Request 11: REJECTED ✗ (fast fail)
        (no HTTP calls made, saves resources)

T+37s: QloApps recovers
       Cooldown expired (30s) → HALF_OPEN

T+38s: HALF_OPEN (test mode)
     ├─ Request 12: SUCCESS ✓ (allowed, testing)
        → State changes to CLOSED
        → Reset failure count
        → Resume normal operation

T+40s: CLOSED (normal again)
     ├─ Request 13: SUCCESS ✓
     ├─ Request 14: SUCCESS ✓
     └─ Request 15: SUCCESS ✓
        (full capacity restored)
```

### 2. Rate Limiting Example

```
Configuration:
- Tokens per window: 100
- Window: 60 seconds
- Token regeneration: ~1.67 tokens per second

Timeline:
─────────────────────────────────────────────────────────────

T+0s: Tokens = 100
     ├─ Request 1: consumes 1 token → 99 remaining
     ├─ Request 2: consumes 1 token → 98 remaining
     ├─ ...
     └─ Request 100: consumes 1 token → 0 remaining

T+0.6s: Request 101: token regenerated → 1 token available
        ├─ Consumes 1 token → 0 remaining
        └─ Continues at ~1 request per 0.6 seconds

T+60s: Window expires → Tokens reset to 100
       (burst capacity restored)
```

### 3. Retry Logic Example

```
Request fails with network timeout:

Attempt 1 (T+0ms):
  fetch() → timeout after 30s
  ❌ FAIL
  Next retry in: 500ms

Attempt 2 (T+500ms):
  fetch() → timeout after 30s
  ❌ FAIL
  Next retry in: 1000ms (500 * 2)

Attempt 3 (T+1500ms):
  fetch() → timeout after 30s
  ❌ FAIL
  Next retry in: 2000ms (1000 * 2)

Attempt 4 (T+3500ms):
  fetch() → timeout after 30s
  ❌ FAIL
  Max retries exhausted (3 attempts)
  → Throw error
  → Message goes to error queue
  → Sync scheduler retries entire sync later
```

### 4. Message Retry Example

```
Outbound Worker:

Message: 'reservation.create' for reservation-123

Attempt 1 (T+0s):
  ├─ Process message
  ├─ QloAppsClient error (circuit breaker open)
  └─ ❌ FAIL
     → Queue delay: 2000ms

Attempt 2 (T+2s):
  ├─ Process message again
  ├─ Circuit breaker HALF_OPEN (test mode)
  ├─ Request succeeds
  └─ ✓ SUCCESS
     → Acknowledge message
     → Remove from queue

If all 3 worker retries fail:
  → Message moved to dead-letter queue
  → Manual investigation required
  → Operator can replay message later
```

---

## API Endpoint Reference

### QloApps API Endpoints

All endpoints use base URL: `http://localhost:8080/api/?io_format=JSON`

#### Bookings

```
GET /api/?io_format=JSON&action=bookings
  Query params:
    - modifiedSince: ISO-8601 timestamp
    - limit: max results
    - bookingStatus: numeric status filter

  Response:
    [
      {
        "id": 789,
        "firstname": "John",
        "lastname": "Doe",
        "email": "john@example.com",
        "phone": "1234567890",
        "status": 1,              // 0=cancelled, 1=confirmed
        "dateFrom": "2024-01-15",
        "dateTo": "2024-01-17",
        "totalPrice": 300.00,
        "notes": "VIP guest",
        ...
      }
    ]

POST /api/?io_format=JSON&action=bookings&operation=add
  Body:
    {
      "firstname": "Jane",
      "lastname": "Smith",
      "email": "jane@example.com",
      "phone": "0987654321",
      "dateFrom": "2024-01-20",
      "dateTo": "2024-01-22",
      "totalPrice": 250.00,
      ...
    }

  Response:
    {
      "id": 790,
      "status": "confirmed",
      ...
    }

PUT /api/?io_format=JSON&action=bookings&operation=update&id=789
  Body:
    {
      "status": 0,  // cancel booking
      ...
    }

DELETE /api/?io_format=JSON&action=bookings&id=789
  (alternative cancellation)
```

#### Customers

```
GET /api/?io_format=JSON&action=customers
  Response: Array of customer objects

POST /api/?io_format=JSON&action=customers&operation=add
  Body: Customer object
  Response: { id, status }
```

#### Room Types

```
GET /api/?io_format=JSON&action=roomtypes
  Response:
    [
      {
        "id": 1,
        "name": "Double Room",
        "quantity": 10,
        ...
      }
    ]
```

#### Availability

```
GET /api/?io_format=JSON&action=availability&roomId=1
  Query params:
    - dateFrom: YYYY-MM-DD
    - dateTo: YYYY-MM-DD
  
  Response:
    {
      "1": [           // room type ID
        { "date": "2024-01-15", "available": 5 },
        { "date": "2024-01-16", "available": 3 },
        ...
      ]
    }

PUT /api/?io_format=JSON&action=availability
  Body:
    {
      "roomId": 1,
      "dateFrom": "2024-01-15",
      "dateTo": "2024-01-17",
      "quantity": 8
    }
```

#### Rates

```
GET /api/?io_format=JSON&action=rates&roomId=1
  Query params:
    - dateFrom: YYYY-MM-DD
    - dateTo: YYYY-MM-DD
  
  Response:
    {
      "1": [           // room type ID
        { "date": "2024-01-15", "rate": 150.00 },
        { "date": "2024-01-16", "rate": 150.00 },
        ...
      ]
    }

PUT /api/?io_format=JSON&action=rates
  Body:
    {
      "roomId": 1,
      "dateFrom": "2024-01-15",
      "dateTo": "2024-01-17",
      "rate": 180.00
    }
```

---

## Configuration

### Environment Variables

```bash
# .env (Backend)
QLO_API_URL=http://localhost:8080/api
QLO_API_KEY=your-api-key-here

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hotel_pms

# Sync Scheduler
QLOAPPS_SYNC_INTERVAL_MS=300000  # 5 minutes
```

### Database Configuration

```sql
-- Active channel manager
ALTER TABLE properties
ADD COLUMN active_channel_manager VARCHAR(50) DEFAULT 'qloapps';

-- QloApps configuration
CREATE TABLE qloapps_config (
  id UUID PRIMARY KEY,
  property_id UUID,
  base_url TEXT,
  api_key_encrypted TEXT,
  qloapps_hotel_id INTEGER,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Reservation mappings (PMS ↔ QloApps)
CREATE TABLE qloapps_reservation_mappings (
  id UUID PRIMARY KEY,
  config_id UUID,
  local_reservation_id VARCHAR(50),
  qloapps_booking_id INTEGER,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Room type mappings
CREATE TABLE qloapps_room_type_mappings (
  id UUID PRIMARY KEY,
  config_id UUID,
  local_room_type_id UUID,
  qloapps_room_type_id INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Sync state tracking
CREATE TABLE qloapps_sync_state (
  id UUID PRIMARY KEY,
  sync_type VARCHAR(100),
  status VARCHAR(50),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  items_processed INTEGER,
  items_created INTEGER,
  items_updated INTEGER,
  items_failed INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  last_successful_sync TIMESTAMP
);
```

---

## Monitoring & Troubleshooting

### Key Metrics to Monitor

1. **Circuit Breaker State**
   - Query: `SELECT * FROM circuit_breaker_state`
   - Alert if: state = 'OPEN' for > 1 minute

2. **Queue Depth**
   - Command: `rabbitmqctl list_queues`
   - Alert if: qloapps.outbound or qloapps.inbound > 1000 messages

3. **Sync Performance**
   - Query: `SELECT * FROM qloapps_sync_state ORDER BY completed_at DESC`
   - Check: duration_ms, items_failed ratio

4. **Error Rate**
   - Track: failed syncs / total syncs
   - Alert if: > 5% failure rate

### Common Issues & Solutions

#### Issue: "Circuit Breaker Open"
**Cause:** QloApps API unreachable or consistently failing
**Solution:**
1. Check QloApps server status
2. Verify network connectivity
3. Check API key validity
4. Wait 30 seconds for circuit breaker to enter HALF_OPEN
5. Monitor logs for recovery

#### Issue: "Rate Limit Exceeded"
**Cause:** Too many requests in short time
**Solution:**
1. Reduce batch sizes for sync operations
2. Increase QLOAPPS_SYNC_INTERVAL_MS
3. Implement request batching on frontend

#### Issue: "Sync Not Running"
**Cause:** Lock held by stale process or scheduler not started
**Solution:**
1. Check if scheduler process is running: `ps aux | grep qloapps_sync_scheduler`
2. Query locks: `SELECT * FROM qloapps_sync_state WHERE status = 'running'`
3. If stale (> 10 min old), manually update to 'failed'
4. Restart scheduler: `npm run worker:qloapps-sync`

#### Issue: "Booking Not Synced"
**Cause:** Validation failure, network error, or duplicate
**Solution:**
1. Check qloapps_sync_state for error_message
2. Verify booking format matches QloApps schema
3. Check qloapps_reservation_mappings for existing mapping
4. Manually retry: replay message to queue

---

## Summary

The QloApps backend communication uses a **robust, scalable architecture** with:

- ✅ **Authentication**: Basic Auth with encrypted API keys
- ✅ **Rate Limiting**: Token bucket algorithm (100 req/min)
- ✅ **Circuit Breaking**: 3-state pattern for fault tolerance
- ✅ **Retry Logic**: Exponential backoff (500ms → 2s max, 3 attempts)
- ✅ **Request Timeouts**: 30-second default per request
- ✅ **Async Processing**: RabbitMQ for decoupled operations
- ✅ **Worker Processes**: Dedicated consumers for inbound/outbound
- ✅ **Scheduled Syncs**: 5-minute interval incremental pulls
- ✅ **Data Mapping**: Comprehensive schema transformation
- ✅ **Error Tracking**: Detailed logging and statistics

This ensures **reliability, scalability, and graceful degradation** under various failure scenarios.
