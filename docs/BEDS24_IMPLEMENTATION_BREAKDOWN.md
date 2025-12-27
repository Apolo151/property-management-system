# Beds24 Integration - Implementation Breakdown

## Overview

This document breaks down the implementation plan from `BEDS24_INTEGRATION_DESIGN.md` into actionable tasks with specific deliverables for each phase.

---

## Phase 1: Foundation (Week 1-2) - **CURRENT PHASE**

### Deliverables
- ✅ Beds24Client wrapper class
- ✅ Authentication & token management
- ✅ Database schema migrations
- ✅ Basic error handling

### Task Breakdown

#### Task 1.1: Database Schema Setup
**Files to Create:**
- `backend/src/database/migrations/20251226000011_create_beds24_config.ts`
- `backend/src/database/migrations/20251226000012_create_sync_conflicts.ts`
- `backend/src/database/migrations/20251226000013_create_webhook_events.ts`
- `backend/src/database/migrations/20251226000014_add_beds24_room_id_to_rooms.ts`

**Schema Details:**
- `beds24_config`: Store OAuth tokens, property mapping, sync settings
- `sync_conflicts`: Track and resolve sync conflicts
- `webhook_events`: Idempotency for webhook processing
- Add `beds24_room_id` column to `rooms` table

#### Task 1.2: Encryption Utility
**Files to Create:**
- `backend/src/utils/encryption.ts`

**Functionality:**
- AES-256 encryption/decryption for tokens
- Environment variable for encryption key
- Secure token storage and retrieval

#### Task 1.3: Beds24Client Class
**Files to Create:**
- `backend/src/integrations/beds24/beds24_client.ts`
- `backend/src/integrations/beds24/beds24_types.ts`
- `backend/src/integrations/beds24/beds24_errors.ts`
- `backend/src/integrations/beds24/beds24_config.ts`

**Key Methods:**
- `authenticate(inviteCode: string): Promise<RefreshTokenResponse>`
- `refreshAccessToken(refreshToken: string): Promise<AccessTokenResponse>`
- `getTokenDetails(token: string): Promise<TokenDetails>`
- `makeRequest<T>(endpoint: string, options: RequestOptions): Promise<T>`
- Rate limiting (100 requests/minute)
- Circuit breaker pattern
- Automatic token refresh

#### Task 1.4: Error Handling
**Files to Create:**
- `backend/src/integrations/beds24/beds24_errors.ts`

**Error Types:**
- `Beds24ApiError`: Base API error
- `Beds24AuthenticationError`: Auth failures
- `Beds24RateLimitError`: Rate limit exceeded
- `Beds24NetworkError`: Network/timeout errors
- `Beds24ValidationError`: Request validation errors

#### Task 1.5: Unit Tests
**Files to Create:**
- `backend/src/integrations/beds24/__tests__/beds24_client.test.ts`

**Test Coverage:**
- Token authentication flow
- Token refresh logic
- Rate limiting behavior
- Error handling
- Circuit breaker

---

## Phase 2: Push Sync (Week 3-4)

### Deliverables
- Reservation push sync
- Availability push sync
- Queue system integration
- Retry logic

### Task Breakdown

#### Task 2.1: Data Mappers
**Files to Create:**
- `backend/src/integrations/beds24/mappers/reservation_mapper.ts`
- `backend/src/integrations/beds24/mappers/availability_mapper.ts`
- `backend/src/integrations/beds24/mappers/guest_mapper.ts`

**Mapping Functions:**
- `mapPmsReservationToBeds24(reservation): Beds24Booking`
- `mapBeds24BookingToPms(booking): ReservationData`
- `mapPmsAvailabilityToBeds24(room, dates): Beds24Calendar`
- `mapBeds24GuestToPms(guest): GuestData`

#### Task 2.2: Reservation Push Service
**Files to Create:**
- `backend/src/integrations/beds24/services/reservation_push_service.ts`

**Methods:**
- `pushReservation(reservationId: string): Promise<SyncResult>`
- `updateReservation(reservationId: string): Promise<SyncResult>`
- `cancelReservation(reservationId: string): Promise<SyncResult>`

#### Task 2.3: Availability Push Service
**Files to Create:**
- `backend/src/integrations/beds24/services/availability_push_service.ts`

**Methods:**
- `pushRoomAvailability(roomId: string, dateRange: DateRange): Promise<SyncResult>`
- `pushAllRoomsAvailability(propertyId: string): Promise<SyncResult[]>`
- `pushRates(roomId: string, rates: RateData[]): Promise<SyncResult>`

#### Task 2.4: Queue Integration
**Files to Create:**
- `backend/src/integrations/beds24/jobs/sync_jobs.ts`
- `backend/src/integrations/beds24/jobs/sync_worker.ts`

**Queue Jobs:**
- `syncReservationJob`: Push reservation to Beds24
- `syncAvailabilityJob`: Push availability updates
- `syncRatesJob`: Push rate changes

**Retry Strategy:**
- Exponential backoff (5s, 25s, 125s)
- Max 3 retries
- Dead letter queue for failures

#### Task 2.5: Event Hooks
**Files to Modify:**
- `backend/src/services/reservations/reservations_controller.ts`
- `backend/src/services/rooms/rooms_controller.ts`

**Integration Points:**
- After reservation create/update → Queue sync job
- After room status change → Queue availability sync
- After rate update → Queue rate sync

---

## Phase 3: Pull Sync & Webhooks (Week 5-6)

### Deliverables
- Webhook endpoint
- Webhook signature verification
- Pull sync scheduler
- Event processing

### Task Breakdown

#### Task 3.1: Webhook Endpoint
**Files to Create:**
- `backend/src/integrations/beds24/webhooks/webhook_handler.ts`
- `backend/src/integrations/beds24/webhooks/webhook_routes.ts`
- `backend/src/integrations/beds24/webhooks/webhook_validator.ts`

**Endpoints:**
- `POST /api/integrations/beds24/webhook`

**Functionality:**
- HMAC signature verification
- Idempotency check (webhook_events table)
- Event routing (created, modified, cancelled, deleted)
- Async processing (queue webhook jobs)

#### Task 3.2: Webhook Event Handlers
**Files to Create:**
- `backend/src/integrations/beds24/webhooks/handlers/booking_created_handler.ts`
- `backend/src/integrations/beds24/webhooks/handlers/booking_modified_handler.ts`
- `backend/src/integrations/beds24/webhooks/handlers/booking_cancelled_handler.ts`
- `backend/src/integrations/beds24/webhooks/handlers/booking_deleted_handler.ts`

**Handler Logic:**
- Parse Beds24 booking data
- Map to PMS format
- Check for conflicts
- Create/update reservation
- Log audit event

#### Task 3.3: Pull Sync Service
**Files to Create:**
- `backend/src/integrations/beds24/services/pull_sync_service.ts`
- `backend/src/integrations/beds24/jobs/pull_sync_job.ts`

**Methods:**
- `pullBookings(propertyId: string, lastModified?: Date): Promise<Booking[]>`
- `syncBookingsToPms(bookings: Booking[]): Promise<SyncResult[]>`
- `reconcileBookings(): Promise<ReconciliationReport>`

**Scheduler:**
- Cron job: Every 5 minutes
- Incremental sync using `modifiedFrom` parameter
- Full sync daily at 3 AM

#### Task 3.4: Guest Matching Service
**Files to Create:**
- `backend/src/integrations/beds24/services/guest_matching_service.ts`

**Matching Logic:**
1. Match by `beds24_guest_id` (if stored)
2. Match by email (case-insensitive)
3. Match by phone (normalized)
4. Create new guest if no match

---

## Phase 4: Conflict Resolution (Week 7-8)

### Deliverables
- Conflict detection logic
- Auto-resolution rules
- Manual resolution UI
- Conflict dashboard

### Task Breakdown

#### Task 4.1: Conflict Detection
**Files to Create:**
- `backend/src/integrations/beds24/services/conflict_detector.ts`

**Detection Rules:**
- Timestamp conflicts (PMS vs Beds24 updated_at)
- Status mismatches
- Date changes
- Amount discrepancies (>5%)

#### Task 4.2: Auto-Resolution Engine
**Files to Create:**
- `backend/src/integrations/beds24/services/conflict_resolver.ts`

**Resolution Strategies:**
- Accept Beds24 (OTA bookings)
- Accept PMS (Direct bookings)
- Manual review (complex conflicts)

#### Task 4.3: Conflict API & Routes
**Files to Create:**
- `backend/src/integrations/beds24/conflicts/conflict_controller.ts`
- `backend/src/integrations/beds24/conflicts/conflict_routes.ts`

**Endpoints:**
- `GET /api/integrations/beds24/conflicts`: List conflicts
- `GET /api/integrations/beds24/conflicts/:id`: Get conflict details
- `POST /api/integrations/beds24/conflicts/:id/resolve`: Resolve conflict
- `GET /api/integrations/beds24/conflicts/stats`: Conflict statistics

#### Task 4.4: Frontend Conflict UI
**Files to Create:**
- `frontend/src/pages/Beds24ConflictsPage.jsx`
- `frontend/src/components/Beds24ConflictCard.jsx`
- `frontend/src/components/Beds24ConflictResolver.jsx`

**UI Features:**
- Side-by-side comparison (PMS vs Beds24)
- Resolution actions (Accept PMS, Accept Beds24, Merge)
- Conflict filtering and search
- Statistics dashboard

---

## Phase 5: Monitoring & Polish (Week 9-10)

### Deliverables
- Monitoring dashboards
- Alerting rules
- Documentation
- Production deployment

### Task Breakdown

#### Task 5.1: Metrics Collection
**Files to Create:**
- `backend/src/integrations/beds24/monitoring/metrics_collector.ts`

**Metrics:**
- Sync success rate
- Sync latency (p50, p95, p99)
- Queue depth
- Conflict rate
- API error rate

#### Task 5.2: Sync Status API
**Files to Create:**
- `backend/src/integrations/beds24/monitoring/sync_status_controller.ts`
- `backend/src/integrations/beds24/monitoring/sync_status_routes.ts`

**Endpoints:**
- `GET /api/integrations/beds24/status`: Overall sync status
- `GET /api/integrations/beds24/metrics`: Sync metrics
- `GET /api/integrations/beds24/health`: Health check

#### Task 5.3: Alerting
**Files to Create:**
- `backend/src/integrations/beds24/monitoring/alerting_service.ts`

**Alert Rules:**
- Sync success rate < 95%
- Queue depth > 1000
- Beds24 API unavailable > 5 minutes
- Conflict rate > 10%

#### Task 5.4: Documentation
**Files to Create:**
- `docs/BEDS24_SETUP_GUIDE.md`: Setup instructions
- `docs/BEDS24_TROUBLESHOOTING.md`: Common issues
- API documentation updates

---

## Implementation Checklist

### Phase 1: Foundation ✅ (Current)
- [ ] Database migrations
- [ ] Encryption utility
- [ ] Beds24Client class
- [ ] Error handling
- [ ] Unit tests

### Phase 2: Push Sync
- [ ] Data mappers
- [ ] Reservation push service
- [ ] Availability push service
- [ ] Queue integration
- [ ] Event hooks

### Phase 3: Pull Sync & Webhooks
- [ ] Webhook endpoint
- [ ] Webhook handlers
- [ ] Pull sync service
- [ ] Guest matching
- [ ] Scheduler setup

### Phase 4: Conflict Resolution
- [ ] Conflict detection
- [ ] Auto-resolution
- [ ] Conflict API
- [ ] Frontend UI

### Phase 5: Monitoring
- [ ] Metrics collection
- [ ] Status API
- [ ] Alerting
- [ ] Documentation

---

## Key API Endpoints from bed24.yaml

### Authentication
- `GET /authentication/setup`: Exchange invite code for refresh token
- `GET /authentication/token`: Get access token from refresh token
- `GET /authentication/details`: Get token details

### Bookings
- `GET /bookings`: Get bookings (with filters: modifiedFrom, modifiedTo)
- `POST /bookings`: Create booking
- `PUT /bookings/{id}`: Update booking
- `DELETE /bookings/{id}`: Delete booking

### Inventory
- `GET /inventory/rooms/calendar`: Get calendar data (availability, prices)
- `PUT /inventory/rooms/calendar`: Update calendar (availability, prices)
- `GET /inventory/rooms/availability`: Get availability
- `PUT /inventory/rooms/availability`: Update availability

### Properties
- `GET /properties`: Get properties
- `GET /properties/rooms`: Get rooms

---

## Next Steps

1. **Start with Phase 1** - Foundation (current phase)
2. Review and approve design
3. Set up development environment
4. Begin implementation

