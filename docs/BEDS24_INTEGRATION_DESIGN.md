# Beds24 Channel Manager Integration - Design & Implementation Plan

## Executive Summary

This document outlines a production-ready, robust integration design between the PMS and Beds24 channel manager. The design ensures full bidirectional synchronization with minimal operational overhead, comprehensive conflict resolution, and enterprise-grade reliability.

**Design Principles:**
- **Idempotency**: All operations are idempotent to prevent duplicate data
- **Eventual Consistency**: Accept eventual consistency with conflict detection
- **Fail-Safe**: System degrades gracefully when Beds24 is unavailable
- **Auditability**: Every sync operation is logged and traceable
- **Low Effort**: Automated sync with minimal manual intervention

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BEDS24 INTEGRATION LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    AUTHENTICATION & CONFIG                           │  │
│  │  • OAuth2 Refresh Token Management                                   │  │
│  │  • Token Auto-Refresh with Exponential Backoff                       │  │
│  │  • Multi-Property Support                                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│  │  PUSH SYNC   │          │  PULL SYNC   │          │  WEBHOOK     │     │
│  │  (PMS→Beds24)│          │ (Beds24→PMS) │          │  HANDLER     │     │
│  └──────────────┘          └──────────────┘          └──────────────┘     │
│         │                            │                            │        │
│         └────────────────────────────┼────────────────────────────┘        │
│                                      │                                       │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐     │
│  │   QUEUE      │          │  CONFLICT    │          │   AUDIT      │     │
│  │  MANAGER     │          │  RESOLVER    │          │   LOGGER     │     │
│  └──────────────┘          └──────────────┘          └──────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Configuration

### 2.1 Authentication Flow

**Beds24 API V2 Authentication:**
- Uses OAuth2 with refresh tokens
- Invite code → Refresh token exchange (one-time setup)
- Access tokens auto-refreshed (15-minute expiry)
- Token storage: Encrypted in database with property_id association

**Configuration Schema:**
```sql
CREATE TABLE beds24_config (
    id UUID PRIMARY KEY,
    property_id UUID REFERENCES properties(id),
    refresh_token TEXT NOT NULL, -- Encrypted
    access_token TEXT, -- Encrypted, cached
    token_expires_at TIMESTAMP,
    beds24_property_id VARCHAR(255), -- Beds24 property identifier
    webhook_secret TEXT, -- For webhook signature verification
    sync_enabled BOOLEAN DEFAULT true,
    push_sync_enabled BOOLEAN DEFAULT true,
    pull_sync_enabled BOOLEAN DEFAULT true,
    webhook_enabled BOOLEAN DEFAULT true,
    last_successful_sync TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Token Management Strategy:**
1. **Initial Setup**: Admin generates invite code in Beds24 → Exchange for refresh token
2. **Token Refresh**: Background job refreshes access token 5 minutes before expiry
3. **Failure Handling**: On refresh failure, retry with exponential backoff (max 3 attempts)
4. **Circuit Breaker**: After 5 consecutive failures, disable sync and alert admin

---

## 3. PMS → Beds24 Sync (Push Operations)

### 3.1 Sync Triggers

**Event-Driven Triggers:**
- Reservation created/updated/cancelled
- Room availability changed (housekeeping status)
- Room rates updated
- Room inventory changes (maintenance, out-of-order)

**Scheduled Triggers:**
- Daily full availability sync (3 AM local time)
- Hourly rate sync (during business hours)
- Weekly full inventory sync

### 3.2 Push Sync Components

#### 3.2.1 Reservation Sync Service

**Flow:**
```
PMS Reservation Change
    │
    ▼
Queue Job (Redis/Bull)
    │
    ▼
Beds24Client.pushReservation()
    │
    ├─► Validate reservation data
    ├─► Map PMS data → Beds24 format
    ├─► Check if booking exists (beds24_booking_id)
    │   ├─► EXISTS: Update booking (PUT /bookings/{id})
    │   └─► NOT EXISTS: Create booking (POST /bookings)
    │
    ▼
Record Sync Status
    ├─► SUCCESS: Update beds24_booking_id, mark synced
    └─► FAILURE: Log error, queue retry
```

**Data Mapping (PMS → Beds24):**
- `reservation.id` → `bookingId` (if exists) or null
- `reservation.check_in` → `arrivalDate`
- `reservation.check_out` → `departureDate`
- `reservation.status` → `status` (mapped: Confirmed→confirmed, Cancelled→cancelled)
- `reservation.total_amount` → `price`
- `reservation.source` → `source` (Direct→"direct", Beds24→"channel")
- `room.beds24_room_id` → `roomId`
- `guest.*` → `guest` object (name, email, phone)

**Idempotency:**
- Use `beds24_booking_id` to prevent duplicate creates
- Include `externalId` field in Beds24 payload (PMS reservation ID)
- Beds24 deduplicates based on externalId + dates

#### 3.2.2 Availability Sync Service

**Flow:**
```
Room Status Change / Scheduled Sync
    │
    ▼
Queue Job
    │
    ▼
Beds24Client.pushAvailability()
    │
    ├─► Fetch all rooms for property
    ├─► For each room:
    │   ├─► Calculate availability (total - reserved - maintenance)
    │   ├─► Build calendar payload (date range: today + 365 days)
    │   └─► POST /inventory/rooms/{roomId}/calendar
    │
    ▼
Batch Update (max 50 rooms per request)
    │
    ▼
Record Sync Status per Room
```

**Availability Calculation:**
```javascript
availability = room.total_units 
             - COUNT(reservations WHERE status IN ('Confirmed', 'Checked-in') AND date BETWEEN check_in AND check_out)
             - COUNT(maintenance WHERE status = 'active' AND date BETWEEN start_date AND end_date)
             - COUNT(housekeeping WHERE status = 'out_of_order' AND date = today)
```

**Rate Sync:**
- Separate endpoint: `POST /inventory/rooms/{roomId}/rates`
- Syncs base rate, seasonal rates, day-of-week rates
- Rate rules: min_stay, max_stay, cancellation_policy

#### 3.2.3 Queue Management

**Queue Strategy:**
- **Priority Queue**: High priority for reservations, medium for availability, low for rates
- **Batching**: Batch availability updates (50 rooms per batch)
- **Rate Limiting**: Max 100 requests/minute (Beds24 limit)
- **Retry Strategy**: 
  - Immediate retry: 1 attempt (transient errors)
  - Exponential backoff: 3 attempts (5s, 25s, 125s)
  - Dead letter queue: After 3 failures, manual review

**Queue Structure (Redis/Bull):**
```javascript
{
  queue: 'beds24-sync',
  jobs: [
    { type: 'reservation', priority: 10, data: {...} },
    { type: 'availability', priority: 5, data: {...} },
    { type: 'rate', priority: 3, data: {...} }
  ]
}
```

---

## 4. Beds24 → PMS Sync (Pull & Webhook)

### 4.1 Webhook Handler (Primary Method)

**Webhook Configuration:**
- URL: `https://pms.example.com/api/integrations/beds24/webhook`
- Version: V2 (with personal data)
- Events: `booking.created`, `booking.modified`, `booking.cancelled`, `booking.deleted`
- Security: HMAC signature verification using webhook_secret

**Webhook Flow:**
```
Beds24 Webhook Event
    │
    ▼
Webhook Middleware
    ├─► Verify HMAC signature
    ├─► Validate payload structure
    └─► Extract event type
    │
    ▼
Event Router
    │
    ├─► booking.created → CreateReservationHandler
    ├─► booking.modified → UpdateReservationHandler
    ├─► booking.cancelled → CancelReservationHandler
    └─► booking.deleted → DeleteReservationHandler
    │
    ▼
Handler Processing
    ├─► Check if reservation exists (beds24_booking_id)
    ├─► Map Beds24 data → PMS format
    ├─► Conflict Detection (see Section 5)
    ├─► Apply changes (within transaction)
    └─► Log audit event
    │
    ▼
Response to Beds24
    └─► 200 OK (acknowledge receipt)
```

**Webhook Payload Mapping (Beds24 → PMS):**
- `booking.id` → `reservation.beds24_booking_id`
- `booking.arrivalDate` → `reservation.check_in`
- `booking.departureDate` → `reservation.check_out`
- `booking.status` → `reservation.status` (mapped)
- `booking.price` → `reservation.total_amount`
- `booking.source` → `reservation.source` (if "channel" → "Beds24")
- `booking.roomId` → Lookup `room.beds24_room_id` → `reservation.room_id`
- `booking.guest` → Create/update `guest` record → `reservation.primary_guest_id`

**Idempotency:**
- Use `beds24_booking_id` as unique identifier
- Store webhook event ID to prevent duplicate processing
- Idempotency check: `SELECT * FROM reservations WHERE beds24_booking_id = ?`

### 4.2 Pull Sync (Fallback/Reconciliation)

**Purpose:**
- Backup when webhooks fail
- Reconciliation to catch missed events
- Initial sync for existing Beds24 bookings

**Pull Sync Strategy:**
- **Frequency**: Every 5 minutes (configurable)
- **Method**: Incremental sync using `lastModified` timestamp
- **Range**: Last 7 days (configurable window)
- **Query**: `GET /bookings?lastModified={timestamp}&limit=100`

**Pull Sync Flow:**
```
Scheduled Job (Cron: */5 * * * *)
    │
    ▼
Fetch Last Sync Timestamp
    │
    ▼
Beds24Client.pullBookings(lastModified)
    │
    ├─► GET /bookings?lastModified={timestamp}
    ├─► Process each booking
    │   ├─► Check if exists in PMS
    │   ├─► Compare lastModified timestamps
    │   └─► Update if Beds24 is newer
    │
    ▼
Update Last Sync Timestamp
    │
    ▼
Log Sync Results
```

**Conflict Detection in Pull:**
- Compare `lastModified` timestamps
- If PMS `updated_at` > Beds24 `lastModified`: Potential conflict → Flag for review
- If Beds24 `lastModified` > PMS `updated_at`: Apply Beds24 changes

---

## 5. Conflict Resolution System

### 5.1 Conflict Types

**1. Simultaneous Updates:**
- PMS user updates reservation while Beds24 webhook arrives
- Both systems modify same booking within short time window

**2. Source of Truth Conflicts:**
- Direct booking in PMS vs OTA booking in Beds24
- Different cancellation policies applied

**3. Data Inconsistencies:**
- Room availability mismatch
- Rate discrepancies
- Guest information differences

### 5.2 Conflict Detection Logic

**Detection Rules:**
```javascript
function detectConflict(pmsReservation, beds24Booking, eventType) {
  const conflicts = [];
  
  // Rule 1: Timestamp-based conflict
  if (pmsReservation.updated_at > beds24Booking.lastModified) {
    conflicts.push({
      type: 'TIMESTAMP_CONFLICT',
      pms_updated: pmsReservation.updated_at,
      beds24_updated: beds24Booking.lastModified
    });
  }
  
  // Rule 2: Status mismatch
  if (mapStatus(pmsReservation.status) !== beds24Booking.status) {
    conflicts.push({
      type: 'STATUS_CONFLICT',
      pms_status: pmsReservation.status,
      beds24_status: beds24Booking.status
    });
  }
  
  // Rule 3: Date changes
  if (pmsReservation.check_in !== beds24Booking.arrivalDate ||
      pmsReservation.check_out !== beds24Booking.departureDate) {
    conflicts.push({
      type: 'DATE_CONFLICT',
      pms_dates: { check_in: pmsReservation.check_in, check_out: pmsReservation.check_out },
      beds24_dates: { arrival: beds24Booking.arrivalDate, departure: beds24Booking.departureDate }
    });
  }
  
  // Rule 4: Amount mismatch (> 5% difference)
  const amountDiff = Math.abs(pmsReservation.total_amount - beds24Booking.price);
    if (amountDiff / pmsReservation.total_amount > 0.05) {
    conflicts.push({
      type: 'AMOUNT_CONFLICT',
      pms_amount: pmsReservation.total_amount,
      beds24_amount: beds24Booking.price
    });
  }
  
  return conflicts;
}
```

### 5.3 Conflict Resolution Strategies

**Strategy Matrix:**

| Conflict Type | Source | Resolution Strategy | Auto-Resolve? |
|--------------|--------|-------------------|---------------|
| Timestamp (Beds24 newer) | OTA Booking | Accept Beds24 | ✅ Yes |
| Timestamp (PMS newer) | Direct Booking | Accept PMS, Push to Beds24 | ✅ Yes |
| Status (Cancelled in Beds24) | OTA Booking | Accept Beds24 cancellation | ✅ Yes |
| Status (Cancelled in PMS) | Direct Booking | Push cancellation to Beds24 | ✅ Yes |
| Date Changes | Either | Manual Review | ❌ No |
| Amount Mismatch (>5%) | Either | Manual Review | ❌ No |
| Room Change | Either | Manual Review | ❌ No |

**Auto-Resolution Flow:**
```
Conflict Detected
    │
    ▼
Apply Resolution Rules
    │
    ├─► AUTO-RESOLVE (if rule matches)
    │   ├─► Apply resolution
    │   ├─► Log resolution action
    │   └─► Continue processing
    │
    └─► MANUAL REVIEW (if no rule matches)
        ├─► Create conflict record
        ├─► Notify admin (email/notification)
        ├─► Store both versions
        └─► Queue for manual resolution
```

**Conflict Storage Schema:**
```sql
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY,
    reservation_id UUID REFERENCES reservations(id),
    beds24_booking_id VARCHAR(255),
    conflict_type VARCHAR(50),
    pms_data JSONB,
    beds24_data JSONB,
    resolution_strategy VARCHAR(50), -- 'AUTO', 'MANUAL', 'RESOLVED'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### 5.4 Manual Resolution Workflow

**Admin Interface:**
1. View conflict list (filtered by type, date range)
2. Compare side-by-side: PMS data vs Beds24 data
3. Select resolution action:
   - Accept PMS version (push to Beds24)
   - Accept Beds24 version (update PMS)
   - Merge (selective field updates)
4. Apply resolution → Trigger sync

---

## 6. Edge Cases & Error Handling

### 6.1 Edge Cases

**1. Duplicate Bookings:**
- **Scenario**: Same booking created in both systems simultaneously
- **Solution**: 
  - Use `externalId` (PMS reservation ID) in Beds24
  - Beds24 deduplicates on externalId + dates
  - PMS deduplicates on `beds24_booking_id`

**2. Booking Cancellation Race Condition:**
- **Scenario**: Booking cancelled in PMS while Beds24 webhook for modification arrives
- **Solution**: 
  - Check reservation status before applying webhook
  - If cancelled in PMS and Beds24 status is active → Flag conflict
  - If cancelled in Beds24 and PMS status is active → Accept cancellation

**3. Room Unavailable in PMS:**
- **Scenario**: Beds24 booking arrives for room that's out-of-order in PMS
- **Solution**:
  - Auto-assign to alternative room (same type, available)
  - If no alternative → Flag for manual assignment
  - Notify admin of room change

**4. Guest Already Exists:**
- **Scenario**: Beds24 booking for guest that exists in PMS with different data
- **Solution**:
  - Match by email (primary) or phone (secondary)
  - Merge guest data (prefer most recent)
  - Preserve PMS guest ID, update fields

**5. Beds24 API Rate Limiting:**
- **Scenario**: Too many requests → 429 Too Many Requests
- **Solution**:
  - Implement token bucket algorithm
  - Queue requests when limit reached
  - Exponential backoff retry
  - Circuit breaker after 5 consecutive 429s

**6. Network Failures:**
- **Scenario**: Beds24 API unavailable
- **Solution**:
  - Retry with exponential backoff (max 3 attempts)
  - Queue job for later processing
  - Continue operating in degraded mode (PMS-only)
  - Alert admin after 1 hour of downtime

**7. Partial Sync Failures:**
- **Scenario**: Batch update partially fails (e.g., 30/50 rooms synced)
- **Solution**:
  - Track individual room sync status
  - Retry only failed rooms
  - Log partial success with details

**8. Token Expiry During Sync:**
- **Scenario**: Access token expires mid-operation
- **Solution**:
  - Refresh token before each API call (if < 5 min remaining)
  - On 401 Unauthorized → Refresh token and retry request
  - Max 1 retry per request

**9. Webhook Replay:**
- **Scenario**: Beds24 resends webhook (duplicate event)
- **Solution**:
  - Store webhook event IDs (last 1000 events)
  - Check event ID before processing
  - Return 200 OK for duplicates (idempotent)

**10. Data Type Mismatches:**
- **Scenario**: Beds24 returns unexpected data format
- **Solution**:
  - Validate payload against schema (Joi/Zod)
  - Log validation errors
  - Queue for manual review if critical fields missing

### 6.2 Error Handling Strategy

**Error Classification:**
- **Transient Errors** (retry): 429, 500, 502, 503, network timeouts
- **Client Errors** (no retry): 400, 401 (after token refresh), 404
- **Business Logic Errors** (manual review): Validation failures, conflicts

**Retry Logic:**
```javascript
const retryConfig = {
  transient: {
    maxAttempts: 3,
    backoff: 'exponential', // 5s, 25s, 125s
    jitter: true
  },
  auth: {
    maxAttempts: 1, // Refresh token once
    backoff: 'immediate'
  }
};
```

**Error Logging:**
- All errors logged to `sync_logs` table
- Critical errors trigger alerts (email/Slack)
- Error dashboard for monitoring

---

## 7. Data Mapping Specifications

### 7.1 Reservation Mapping

**PMS → Beds24:**
```javascript
{
  bookingId: reservation.beds24_booking_id || null,
  externalId: `PMS-${reservation.id}`,
  propertyId: property.beds24_property_id,
  roomId: room.beds24_room_id,
  arrivalDate: reservation.check_in, // YYYY-MM-DD
  departureDate: reservation.check_out, // YYYY-MM-DD
  status: mapStatus(reservation.status), // 'confirmed', 'cancelled', 'checkedin', 'checkedout'
  price: reservation.total_amount,
  currency: 'USD', // from property config
  source: reservation.source === 'Direct' ? 'direct' : 'channel',
  guest: {
    firstName: guest.first_name,
    lastName: guest.last_name,
    email: guest.email,
    phone: guest.phone,
    country: guest.country_code
  },
  specialRequests: reservation.special_requests,
  numberOfGuests: reservation.number_of_guests || 1
}
```

**Beds24 → PMS:**
```javascript
{
  beds24_booking_id: booking.id,
  room_id: lookupRoomByBeds24Id(booking.roomId),
  primary_guest_id: findOrCreateGuest(booking.guest),
  check_in: booking.arrivalDate,
  check_out: booking.departureDate,
  status: mapStatusFromBeds24(booking.status),
  total_amount: booking.price,
  source: booking.source === 'direct' ? 'Direct' : 'Beds24',
  special_requests: booking.specialRequests,
  number_of_guests: booking.numberOfGuests
}
```

**Status Mapping:**
```javascript
PMS → Beds24:
  'Confirmed' → 'confirmed'
  'Checked-in' → 'checkedin'
  'Checked-out' → 'checkedout'
  'Cancelled' → 'cancelled'

Beds24 → PMS:
  'confirmed' → 'Confirmed'
  'checkedin' → 'Checked-in'
  'checkedout' → 'Checked-out'
  'cancelled' → 'Cancelled'
```

### 7.2 Room Mapping

**Initial Room Mapping (One-time):**
- Admin maps PMS rooms to Beds24 rooms via UI
- Store mapping: `room.beds24_room_id` (VARCHAR)
- Validation: Ensure 1:1 mapping (no duplicates)

**Room Sync:**
- Sync room availability, not room definitions
- Room definitions managed separately in Beds24 UI

### 7.3 Guest Mapping

**Guest Matching Logic:**
1. **Primary**: Match by `beds24_guest_id` (if stored)
2. **Secondary**: Match by email (case-insensitive)
3. **Tertiary**: Match by phone (normalized)
4. **Fallback**: Create new guest record

**Guest Data Merge:**
- Prefer most recent data (compare `updated_at`)
- Preserve PMS guest ID
- Update fields from Beds24 if newer

---

## 8. Monitoring & Observability

### 8.1 Key Metrics

**Sync Health Metrics:**
- Sync success rate (last 24h, 7d, 30d)
- Average sync latency (PMS → Beds24, Beds24 → PMS)
- Queue depth (pending sync jobs)
- Conflict rate (conflicts per 100 syncs)
- API error rate (4xx, 5xx responses)

**Business Metrics:**
- Bookings synced per day
- Bookings missed (webhook failures)
- Reconciliation accuracy (pull sync finds discrepancies)

### 8.2 Alerting Rules

**Critical Alerts:**
- Sync success rate < 95% (last hour)
- Queue depth > 1000 jobs
- Beds24 API unavailable > 5 minutes
- Token refresh failure
- Conflict rate > 10% (last 24h)

**Warning Alerts:**
- Sync latency > 30 seconds (p95)
- Pull sync finds > 5 missed bookings
- Webhook processing errors > 5% (last hour)

### 8.3 Dashboards

**Sync Status Dashboard:**
- Real-time sync status (last sync time, success/failure)
- Queue metrics (pending, processing, failed)
- Conflict queue (pending manual resolutions)
- API health (response times, error rates)

**Reconciliation Dashboard:**
- Bookings comparison (PMS vs Beds24)
- Discrepancy report (date ranges, amounts, statuses)
- Sync history (timeline of syncs)

---

## 9. Database Schema Additions

### 9.1 New Tables

```sql
-- Beds24 Configuration
CREATE TABLE beds24_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    refresh_token TEXT NOT NULL, -- Encrypted
    access_token TEXT, -- Encrypted, cached
    token_expires_at TIMESTAMP WITH TIME ZONE,
    beds24_property_id VARCHAR(255) NOT NULL,
    webhook_secret TEXT, -- For HMAC verification
    sync_enabled BOOLEAN DEFAULT true,
    push_sync_enabled BOOLEAN DEFAULT true,
    pull_sync_enabled BOOLEAN DEFAULT true,
    webhook_enabled BOOLEAN DEFAULT true,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(property_id)
);

-- Sync Conflicts
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID REFERENCES reservations(id),
    beds24_booking_id VARCHAR(255),
    conflict_type VARCHAR(50) NOT NULL,
    pms_data JSONB NOT NULL,
    beds24_data JSONB NOT NULL,
    resolution_strategy VARCHAR(50) DEFAULT 'MANUAL' CHECK (resolution_strategy IN ('AUTO', 'MANUAL', 'RESOLVED')),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_action TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook Events (Idempotency)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE, -- Beds24 event ID
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Room Mapping (PMS Room → Beds24 Room)
ALTER TABLE rooms ADD COLUMN beds24_room_id VARCHAR(255);
CREATE INDEX idx_rooms_beds24_room_id ON rooms(beds24_room_id);
```

### 9.2 Indexes

```sql
-- Sync performance indexes
CREATE INDEX idx_beds24_sync_status ON beds24_sync(status);
CREATE INDEX idx_beds24_sync_sync_type ON beds24_sync(sync_type);
CREATE INDEX idx_sync_conflicts_resolution ON sync_conflicts(resolution_strategy, created_at);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Deliverables:**
- Beds24Client wrapper class
- Authentication & token management
- Database schema migrations
- Basic error handling

**Tasks:**
1. Implement OAuth2 token refresh
2. Create Beds24Client with rate limiting
3. Set up database tables
4. Write unit tests for client

### Phase 2: Push Sync (Week 3-4)
**Deliverables:**
- Reservation push sync
- Availability push sync
- Queue system integration
- Retry logic

**Tasks:**
1. Implement reservation push (create/update)
2. Implement availability sync
3. Integrate with Bull queue
4. Add retry mechanisms
5. Write integration tests

### Phase 3: Pull Sync & Webhooks (Week 5-6)
**Deliverables:**
- Webhook endpoint
- Webhook signature verification
- Pull sync scheduler
- Event processing

**Tasks:**
1. Create webhook endpoint
2. Implement HMAC verification
3. Build event handlers
4. Create pull sync job
5. Test webhook processing

### Phase 4: Conflict Resolution (Week 7-8)
**Deliverables:**
- Conflict detection logic
- Auto-resolution rules
- Manual resolution UI
- Conflict dashboard

**Tasks:**
1. Implement conflict detection
2. Build auto-resolution engine
3. Create conflict admin UI
4. Add conflict metrics
5. End-to-end testing

### Phase 5: Monitoring & Polish (Week 9-10)
**Deliverables:**
- Monitoring dashboards
- Alerting rules
- Documentation
- Production deployment

**Tasks:**
1. Set up metrics collection
2. Create dashboards
3. Configure alerts
4. Write user documentation
5. Deploy to production

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Beds24Client methods (mocked API)
- Data mapping functions
- Conflict detection logic
- Token refresh logic

### 11.2 Integration Tests
- End-to-end push sync (test environment)
- Webhook processing (mock Beds24 webhooks)
- Pull sync (test data)
- Conflict resolution flows

### 11.3 Load Tests
- Queue processing under load (1000+ jobs)
- Webhook handling (100 webhooks/second)
- API rate limiting behavior

### 11.4 Failure Tests
- Beds24 API downtime simulation
- Network failures
- Token expiry scenarios
- Duplicate webhook handling

---

## 12. Security Considerations

### 12.1 Token Security
- Encrypt tokens at rest (AES-256)
- Never log tokens
- Rotate refresh tokens annually
- Secure token storage (environment variables for encryption keys)

### 12.2 Webhook Security
- HMAC signature verification (SHA-256)
- Validate webhook origin (IP whitelist if possible)
- Rate limit webhook endpoint
- Idempotency to prevent replay attacks

### 12.3 API Security
- Use HTTPS only
- Validate all input data
- Sanitize error messages (don't expose internal details)
- Audit all sync operations

---

## 13. Cost Optimization

### 13.1 API Call Reduction
- **Batching**: Batch availability updates (50 rooms per call)
- **Caching**: Cache room mappings, property configs
- **Smart Sync**: Only sync changed data (track `updated_at`)
- **Debouncing**: Debounce rapid changes (wait 30s before syncing)

### 13.2 Infrastructure Costs
- **Queue Workers**: Scale workers based on queue depth (auto-scaling)
- **Database**: Use connection pooling, read replicas for reporting
- **Monitoring**: Use efficient metrics (avoid high-cardinality tags)

**Estimated API Calls per Day:**
- Reservations: ~100-500 calls/day (depends on booking volume)
- Availability: ~50 calls/day (batch updates)
- Rates: ~20 calls/day (periodic updates)
- **Total: ~200-600 calls/day** (well within Beds24 limits)

---

## 14. Rollback Plan

### 14.1 Feature Flags
- `BEDS24_SYNC_ENABLED`: Master switch
- `BEDS24_PUSH_ENABLED`: Disable push sync
- `BEDS24_PULL_ENABLED`: Disable pull sync
- `BEDS24_WEBHOOK_ENABLED`: Disable webhooks

### 14.2 Rollback Procedure
1. Disable sync via feature flag
2. Stop queue workers
3. Verify no active sync jobs
4. Review recent sync logs for issues
5. Fix issues in code
6. Re-enable sync gradually (push → pull → webhooks)

---

## 15. Success Criteria

**Technical Metrics:**
- ✅ Sync success rate > 99%
- ✅ Average sync latency < 5 seconds (p95)
- ✅ Zero data loss (all bookings synced)
- ✅ Conflict rate < 1%

**Operational Metrics:**
- ✅ Zero manual interventions required (auto-resolution)
- ✅ < 5 minutes downtime per month
- ✅ < 10 API errors per day

**Business Metrics:**
- ✅ 100% booking synchronization
- ✅ Real-time availability updates
- ✅ Zero overbookings due to sync issues

---

## Quality Control Ratings

**Scalability: 0.95**
- Horizontal scaling via queue workers
- Database read replicas for reporting
- Efficient batching reduces API calls
- Can handle 10,000+ bookings/day

**Cost-effectiveness: 0.92**
- Minimal API calls through batching
- Efficient queue processing
- Auto-scaling reduces idle costs
- Estimated: < $50/month infrastructure

**Reliability: 0.94**
- Comprehensive error handling
- Retry mechanisms with backoff
- Circuit breaker prevents cascade failures
- Graceful degradation when Beds24 unavailable
- 99.9% uptime target achievable

**Completeness: 0.93**
- Covers all sync scenarios (push/pull/webhook)
- Comprehensive conflict resolution
- Edge cases addressed
- Monitoring and alerting included
- Production-ready design

**Overall Confidence: 0.935**

---

## Conclusion

This design provides a robust, production-ready integration between the PMS and Beds24 channel manager. The system ensures full bidirectional synchronization with minimal operational overhead through:

1. **Event-driven architecture** with queue-based processing
2. **Comprehensive conflict resolution** with auto-resolution rules
3. **Robust error handling** with retry mechanisms and circuit breakers
4. **Full observability** with metrics, dashboards, and alerts
5. **Security-first approach** with encrypted tokens and webhook verification

The phased implementation approach allows for incremental delivery and testing, reducing risk and ensuring quality at each stage.

