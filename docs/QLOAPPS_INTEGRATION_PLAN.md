# QloApps Channel Manager Integration Plan

## Document Information

- **Version:** 1.0
- **Date:** January 2026
- **Status:** Planning
- **Integration Type:** QloApps as Broker to Channel Manager
- **Estimated Duration:** 4-6 weeks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Model Mapping](#3-data-model-mapping)
4. [QloApps API Reference](#4-qloapps-api-reference)
5. [Work Breakdown Structure (WBS)](#5-work-breakdown-structure-wbs)
6. [Phase 1: Database Schema](#phase-1-database-schema)
7. [Phase 2: QloApps Client](#phase-2-qloapps-client)
8. [Phase 3: Sync Services](#phase-3-sync-services)
9. [Phase 4: API Routes](#phase-4-api-routes)
10. [Phase 5: Workers & Scheduling](#phase-5-workers--scheduling)
11. [Phase 6: Testing & Validation](#phase-6-testing--validation)
12. [Risk Mitigation](#7-risk-mitigation)
13. [Success Criteria](#8-success-criteria)

---

## 1. Executive Summary

### Purpose
Integrate the PMS with QloApps Channel Manager using QloApps as a **broker/middleware**. QloApps will handle all OTA (Booking.com, Expedia, Airbnb, etc.) connections while the PMS remains the source of truth for operations.

### Strategy: Broker Integration
```
┌──────────────┐     REST API      ┌──────────────┐      ┌─────────────────────┐
│   Your PMS   │◄─────────────────►│ QloApps PMS  │◄────►│ QloApps Channel     │
│  (Primary)   │   (Bi-directional │  (Broker)    │      │ Manager (OTAs)      │
└──────────────┘       Sync)       └──────────────┘      └─────────────────────┘
```

### Why Broker Integration?
1. **Feasibility**: QloApps exposes a well-documented WebService API
2. **Maintenance**: QloApps handles OTA API changes and certifications
3. **Time to Market**: 4-6 weeks vs 3-6 months for direct integration
4. **Support**: QloApps community + documentation available

### Integration Scope
| Component | Direction | Description |
|-----------|-----------|-------------|
| Room Types | Bi-directional | Sync room type definitions |
| Availability | PMS → QloApps | Push availability updates |
| Rates/Pricing | PMS → QloApps | Push rate changes |
| Reservations | Bi-directional | Receive OTA bookings, push direct bookings |
| Guests/Customers | Bi-directional | Sync guest information |

---

## 2. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR PMS BACKEND                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     QLOAPPS INTEGRATION LAYER                        │    │
│  │  (Modeled after existing Beds24 integration patterns)               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│         │                            │                            │         │
│         ▼                            ▼                            ▼         │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐      │
│  │  QloApps     │          │  QloApps     │          │  Sync        │      │
│  │  Client      │          │  Mappers     │          │  Workers     │      │
│  │  (API Calls) │          │ (Transform)  │          │  (Scheduled) │      │
│  └──────────────┘          └──────────────┘          └──────────────┘      │
│         │                            │                            │         │
│         └────────────────────────────┼────────────────────────────┘         │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DATABASE LAYER                               │    │
│  │  • qloapps_config           • qloapps_room_type_mappings            │    │
│  │  • qloapps_reservation_mappings   • qloapps_customer_mappings       │    │
│  │  • qloapps_sync_state       • qloapps_sync_logs                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS REST API
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QLOAPPS INSTANCE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     WEBSERVICE API (/api/*)                          │    │
│  │  Endpoints:                                                          │    │
│  │  • GET/POST/PUT /api/bookings       - Booking management            │    │
│  │  • GET/POST/PUT /api/room_types     - Room type management          │    │
│  │  • GET/POST/PUT /api/customers      - Customer management           │    │
│  │  • GET /api/hotel_booking_detail    - Booking details               │    │
│  │  • GET /api/hotel_room_information  - Room inventory                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              CHANNEL MANAGER MODULE (Addon)                          │    │
│  │  • Booking.com    • Expedia    • Airbnb    • 50+ OTAs               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Flow Diagram

```
INBOUND SYNC (OTA Bookings → PMS)
=================================
OTA (Booking.com/Expedia/etc.)
         │
         ▼
QloApps Channel Manager
         │
         ▼ (stores booking)
QloApps WebService API (/api/bookings)
         │
         │ Pull Sync (every 5 min)
         ▼
PMS Sync Worker (inbound_qloapps_worker.ts)
         │
         ├─► Map QloApps booking → PMS reservation
         ├─► Find/Create guest from customer data
         ├─► Find room type mapping
         └─► Insert/Update reservation in PMS DB


OUTBOUND SYNC (PMS → OTAs)
==========================
PMS Direct Booking / Rate Change / Availability Update
         │
         ▼
Event Hook (reservation.created, rate.updated, etc.)
         │
         ▼
Queue Job (RabbitMQ/Bull)
         │
         ▼
PMS Sync Worker (outbound_qloapps_worker.ts)
         │
         ├─► Map PMS data → QloApps format
         └─► POST/PUT to QloApps WebService API
                    │
                    ▼
         QloApps Channel Manager
                    │
                    ▼
         OTAs (Booking.com/Expedia/etc.)
```

---

## 3. Data Model Mapping

### 3.1 PMS to QloApps Entity Mapping

| PMS Entity | PMS Table | QloApps Entity | QloApps Resource |
|------------|-----------|----------------|------------------|
| Room Type | `room_types` | HotelRoomType | `/api/room_types` |
| Reservation | `reservations` | Order + HotelBookingDetail | `/api/bookings` |
| Guest | `guests` | Customer | `/api/customers` |
| Hotel | `hotel_settings` | HotelBranchInformation | `/api/hotels` |

### 3.2 Room Type Field Mapping

```
PMS room_types                    QloApps HotelRoomType (Product)
═══════════════════════════════   ═══════════════════════════════
id                            →   (stored in qloapps_room_type_mappings)
name                          →   name (multilang)
room_type                     →   (category mapping)
qty                           →   quantity (via HotelRoomInformation count)
price_per_night               →   price
max_people                    →   max_adults + max_children
max_adult                     →   max_adults
max_children                  →   max_children
min_stay                      →   (via HotelRoomTypeRestrictionDateRange)
max_stay                      →   (via HotelRoomTypeRestrictionDateRange)
description                   →   description (multilang)
features                      →   (via HotelRoomTypeFeaturePricing)
beds24_room_id                →   (not used - separate integration)
```

### 3.3 Reservation Field Mapping

```
PMS reservations                  QloApps Booking (via /api/bookings)
═══════════════════════════════   ═══════════════════════════════
id                            →   (stored in qloapps_reservation_mappings)
room_type_id                  →   room_types[].id_room_type
check_in                      →   room_types[].date_from
check_out                     →   room_types[].date_to
status                        →   booking_status (1=new, 2=completed, 3=cancelled, 4=refunded)
total_amount                  →   total_price
source                        →   (derived from channel)
primary_guest_id              →   customer_detail
special_requests              →   (not directly mapped - use notes)

Status Mapping:
  PMS 'Confirmed'    → QloApps 1 (API_BOOKING_STATUS_NEW)
  PMS 'Checked-in'   → QloApps 2 (API_BOOKING_STATUS_COMPLETED)
  PMS 'Checked-out'  → QloApps 2 (API_BOOKING_STATUS_COMPLETED)
  PMS 'Cancelled'    → QloApps 3 (API_BOOKING_STATUS_CANCELLED)
```

### 3.4 Guest/Customer Field Mapping

```
PMS guests                        QloApps Customer
═══════════════════════════════   ═══════════════════════════════
id                            →   (stored in qloapps_customer_mappings)
name                          →   firstname + lastname (split)
email                         →   email
phone                         →   phone
notes                         →   (not mapped)
preferences                   →   (not mapped)
```

---

## 4. QloApps API Reference

### 4.1 Authentication

QloApps uses **API Key authentication** (PrestaShop-style WebService):

```bash
# API Key as HTTP Basic Auth username, empty password
curl -u "YOUR_API_KEY:" https://your-qloapps.com/api/

# Or via header
curl -H "Authorization: Basic BASE64(API_KEY:)" https://your-qloapps.com/api/
```

### 4.2 Request/Response Formats

**Supported Formats:**
- XML (default)
- JSON (via `Output-Format: JSON` header or `output_format=JSON` query param)

**Example: Get Room Types (JSON)**
```bash
curl -u "API_KEY:" \
  -H "Output-Format: JSON" \
  "https://qloapps.example.com/api/room_types?display=full"
```

### 4.3 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/` | GET | List all available resources |
| `/api/bookings` | GET | List bookings |
| `/api/bookings/{id}` | GET | Get booking details |
| `/api/bookings` | POST | Create booking |
| `/api/bookings/{id}` | PUT | Update booking |
| `/api/room_types` | GET | List room types |
| `/api/room_types/{id}` | GET | Get room type |
| `/api/customers` | GET | List customers |
| `/api/customers` | POST | Create customer |
| `/api/customers/{id}` | PUT | Update customer |
| `/api/hotels` | GET | List hotels (HotelBranchInformation) |

### 4.4 Booking API Schema

**Booking Status Constants:**
```
API_BOOKING_STATUS_NEW = 1
API_BOOKING_STATUS_COMPLETED = 2
API_BOOKING_STATUS_CANCELLED = 3
API_BOOKING_STATUS_REFUNDED = 4

API_BOOKING_PAYMENT_STATUS_COMPLETED = 1
API_BOOKING_PAYMENT_STATUS_PARTIAL = 2
API_BOOKING_PAYMENT_STATUS_AWAITING = 3
```

**Create Booking Request (JSON):**
```json
{
  "booking": {
    "currency": "USD",
    "booking_status": 1,
    "payment_status": 1,
    "payment_type": "cash",
    "source": "webservice",
    "customer_detail": {
      "firstname": "John",
      "lastname": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "room_types": [
      {
        "id_room_type": 5,
        "date_from": "2026-01-15",
        "date_to": "2026-01-20",
        "number_of_rooms": 1,
        "occupancy": [
          { "adults": 2, "children": 0, "child_ages": [] }
        ]
      }
    ]
  }
}
```

### 4.5 Filtering & Pagination

```bash
# Filter by date range
GET /api/bookings?filter[date_from]=%3E%3D[2026-01-01]&filter[date_to]=%3C%3D[2026-01-31]

# Filter by status
GET /api/bookings?filter[booking_status]=1

# Pagination
GET /api/bookings?limit=50&offset=0

# Display specific fields
GET /api/bookings?display=[id,date_from,date_to,total_price]

# Full details
GET /api/bookings?display=full
```

---

## 5. Work Breakdown Structure (WBS)

### Overview

```
QLOAPPS INTEGRATION
│
├── Phase 1: Database Schema (Week 1)
│   ├── 1.1 Create migration for qloapps_config table
│   ├── 1.2 Create migration for qloapps_room_type_mappings table
│   ├── 1.3 Create migration for qloapps_reservation_mappings table
│   ├── 1.4 Create migration for qloapps_customer_mappings table
│   ├── 1.5 Create migration for qloapps_sync_state table
│   └── 1.6 Create migration for qloapps_sync_logs table
│
├── Phase 2: QloApps Client (Week 1-2)
│   ├── 2.1 Create QloApps client configuration
│   ├── 2.2 Implement authentication handler
│   ├── 2.3 Implement room types API methods
│   ├── 2.4 Implement bookings API methods
│   ├── 2.5 Implement customers API methods
│   ├── 2.6 Implement error handling and retry logic
│   └── 2.7 Create QloApps types and interfaces
│
├── Phase 3: Sync Services (Week 2-3)
│   ├── 3.1 Create data mappers (PMS ↔ QloApps)
│   ├── 3.2 Implement inbound room type sync
│   ├── 3.3 Implement inbound reservation sync
│   ├── 3.4 Implement outbound reservation sync
│   ├── 3.5 Implement outbound availability sync
│   ├── 3.6 Implement outbound rate sync
│   ├── 3.7 Implement guest matching service
│   └── 3.8 Implement conflict resolution
│
├── Phase 4: API Routes (Week 3)
│   ├── 4.1 Create configuration endpoints
│   ├── 4.2 Create connection test endpoint
│   ├── 4.3 Create manual sync trigger endpoints
│   ├── 4.4 Create mapping management endpoints
│   └── 4.5 Create sync logs endpoint
│
├── Phase 5: Workers & Scheduling (Week 4)
│   ├── 5.1 Create inbound sync worker
│   ├── 5.2 Create outbound sync worker
│   ├── 5.3 Implement sync scheduler
│   ├── 5.4 Add event hooks for real-time sync
│   └── 5.5 Implement health monitoring
│
└── Phase 6: Testing & Documentation (Week 4-5)
    ├── 6.1 Unit tests for client
    ├── 6.2 Integration tests with QloApps demo
    ├── 6.3 End-to-end sync tests
    ├── 6.4 Create admin UI components
    └── 6.5 Write documentation
```

---

## Phase 1: Database Schema

### Task 1.1: Create QloApps Config Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_config.ts`

**Description:** Create table to store QloApps connection configuration.

**Table Schema:**
```sql
CREATE TABLE qloapps_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES hotel_settings(id) ON DELETE CASCADE,
    
    -- Connection settings
    base_url VARCHAR(500) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    qloapps_hotel_id INTEGER NOT NULL,
    
    -- Sync configuration
    sync_interval_minutes INTEGER DEFAULT 15,
    sync_enabled BOOLEAN DEFAULT true,
    sync_reservations_inbound BOOLEAN DEFAULT true,
    sync_reservations_outbound BOOLEAN DEFAULT true,
    sync_availability BOOLEAN DEFAULT true,
    sync_rates BOOLEAN DEFAULT true,
    
    -- Status tracking
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    last_sync_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_property_config UNIQUE (property_id)
);
```

**Indexes:**
- `idx_qloapps_config_property_id` on `property_id`
- `idx_qloapps_config_sync_enabled` on `sync_enabled`

**Agent Instructions:**
1. Create new migration file in `src/database/migrations/`
2. Use Knex migration pattern matching existing migrations
3. Add encrypted API key column (use existing encryption utility)
4. Reference `hotel_settings` table for `property_id`
5. Set default property_id to `'00000000-0000-0000-0000-000000000001'::uuid`

---

### Task 1.2: Create Room Type Mappings Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_room_type_mappings.ts`

**Description:** Map PMS room types to QloApps room types (products).

**Table Schema:**
```sql
CREATE TABLE qloapps_room_type_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Mapping references
    local_room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
    qloapps_product_id INTEGER NOT NULL,
    qloapps_hotel_id INTEGER NOT NULL,
    
    -- Sync metadata
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_direction VARCHAR(20) DEFAULT 'bidirectional',
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_local_room_type UNIQUE (local_room_type_id),
    CONSTRAINT unique_qloapps_product UNIQUE (qloapps_product_id, qloapps_hotel_id),
    CONSTRAINT check_sync_direction CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional'))
);
```

**Agent Instructions:**
1. Create migration referencing `room_types` table
2. Add unique constraints to prevent duplicate mappings
3. Include `sync_direction` for flexible sync control
4. Add `qloapps_hotel_id` for multi-hotel support in QloApps

---

### Task 1.3: Create Reservation Mappings Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_reservation_mappings.ts`

**Description:** Map PMS reservations to QloApps bookings/orders.

**Table Schema:**
```sql
CREATE TABLE qloapps_reservation_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Mapping references
    local_reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    qloapps_order_id INTEGER NOT NULL,
    qloapps_booking_id INTEGER,
    
    -- Sync metadata
    source VARCHAR(20) NOT NULL DEFAULT 'local',
    qloapps_channel VARCHAR(100),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_local_update TIMESTAMP WITH TIME ZONE,
    last_qloapps_update TIMESTAMP WITH TIME ZONE,
    
    -- Conflict tracking
    has_conflict BOOLEAN DEFAULT false,
    conflict_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_local_reservation UNIQUE (local_reservation_id),
    CONSTRAINT unique_qloapps_order UNIQUE (qloapps_order_id),
    CONSTRAINT check_source CHECK (source IN ('local', 'qloapps', 'ota'))
);
```

**Agent Instructions:**
1. Create migration referencing `reservations` table
2. Track both `qloapps_order_id` and `qloapps_booking_id` (QloApps uses both)
3. Include conflict tracking columns for resolution
4. Store OTA channel name from QloApps

---

### Task 1.4: Create Customer Mappings Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_customer_mappings.ts`

**Description:** Map PMS guests to QloApps customers.

**Table Schema:**
```sql
CREATE TABLE qloapps_customer_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Mapping references
    local_guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    qloapps_customer_id INTEGER NOT NULL,
    
    -- Match metadata
    match_method VARCHAR(50) DEFAULT 'email',
    confidence_score DECIMAL(3, 2) DEFAULT 1.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_local_guest UNIQUE (local_guest_id),
    CONSTRAINT unique_qloapps_customer UNIQUE (qloapps_customer_id),
    CONSTRAINT check_match_method CHECK (match_method IN ('email', 'phone', 'name', 'manual'))
);
```

**Agent Instructions:**
1. Create migration referencing `guests` table
2. Include `match_method` to track how matching was done
3. Include `confidence_score` for fuzzy matches

---

### Task 1.5: Create Sync State Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_sync_state.ts`

**Description:** Track sync operation state for incremental syncs and preventing overlaps.

**Table Schema:**
```sql
CREATE TABLE qloapps_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Sync identification
    sync_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_successful_sync TIMESTAMP WITH TIME ZONE,
    
    -- Cursor for incremental sync
    sync_cursor JSONB,
    
    -- Statistics
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    duration_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_status CHECK (status IN ('running', 'completed', 'failed')),
    CONSTRAINT check_sync_type CHECK (sync_type IN (
        'qloapps_reservations_inbound',
        'qloapps_reservations_outbound',
        'qloapps_room_types_inbound',
        'qloapps_availability_outbound',
        'qloapps_rates_outbound',
        'qloapps_full_sync'
    ))
);
```

**Indexes:**
- `idx_qloapps_sync_state_running` on `(sync_type, status, started_at)` WHERE `status = 'running'`
- `idx_qloapps_sync_state_last_successful` on `(sync_type, status, completed_at DESC)` WHERE `status = 'completed'`

**Agent Instructions:**
1. Model after existing `sync_state` table pattern
2. Add QloApps-specific sync types
3. Include `sync_cursor` JSONB for storing pagination state

---

### Task 1.6: Create Sync Logs Migration

**File:** `src/database/migrations/YYYYMMDDHHMMSS_create_qloapps_sync_logs.ts`

**Description:** Detailed logging of sync operations for debugging and auditing.

**Table Schema:**
```sql
CREATE TABLE qloapps_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference
    sync_state_id UUID REFERENCES qloapps_sync_state(id) ON DELETE SET NULL,
    
    -- Log details
    sync_type VARCHAR(50) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    local_entity_id UUID,
    qloapps_entity_id INTEGER,
    
    -- Operation
    operation VARCHAR(20) NOT NULL,
    success BOOLEAN NOT NULL,
    
    -- Data
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    
    -- Timing
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_direction CHECK (direction IN ('inbound', 'outbound')),
    CONSTRAINT check_operation CHECK (operation IN ('create', 'update', 'delete', 'skip', 'conflict'))
);
```

**Indexes:**
- `idx_qloapps_sync_logs_created_at` on `created_at`
- `idx_qloapps_sync_logs_entity` on `(entity_type, local_entity_id)`
- `idx_qloapps_sync_logs_success` on `success` WHERE `success = false`

**Agent Instructions:**
1. Create table for detailed operation logging
2. Store request/response data for debugging
3. Add index on failed operations for quick error review
4. Consider partitioning or cleanup strategy for log retention

---

## Phase 2: QloApps Client

### Task 2.1: Create QloApps Configuration

**File:** `src/integrations/qloapps/qloapps_config.ts`

**Description:** Configuration constants and defaults for QloApps integration.

**Implementation:**
```typescript
export const QLOAPPS_CONFIG = {
  // API defaults
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
  
  // Sync intervals
  DEFAULT_SYNC_INTERVAL_MINUTES: 15,
  MIN_SYNC_INTERVAL_MINUTES: 5,
  MAX_SYNC_INTERVAL_MINUTES: 60,
  
  // Batch sizes
  BOOKING_BATCH_SIZE: 50,
  ROOM_TYPE_BATCH_SIZE: 20,
  
  // Date ranges
  AVAILABILITY_FUTURE_DAYS: 365,
  RATE_FUTURE_DAYS: 365,
  BOOKING_LOOKBACK_DAYS: 7,
  
  // Status mappings
  BOOKING_STATUS: {
    NEW: 1,
    COMPLETED: 2,
    CANCELLED: 3,
    REFUNDED: 4,
  },
  PAYMENT_STATUS: {
    COMPLETED: 1,
    PARTIAL: 2,
    AWAITING: 3,
  },
} as const;
```

**Agent Instructions:**
1. Create new file in `src/integrations/qloapps/`
2. Follow pattern from `src/integrations/beds24/beds24_config.ts`
3. Export typed configuration object
4. Include all QloApps-specific constants

---

### Task 2.2: Create QloApps Types

**File:** `src/integrations/qloapps/qloapps_types.ts`

**Description:** TypeScript interfaces for QloApps API data structures.

**Key Interfaces:**
```typescript
// Configuration
export interface QloAppsConfig {
  baseUrl: string;
  apiKey: string;
  hotelId: number;
  syncIntervalMinutes: number;
  timeout?: number;
}

// Room Type (Product in QloApps)
export interface QloAppsRoomType {
  id: number;
  id_hotel: number;
  name: string;
  price: number;
  max_adults: number;
  max_children: number;
  max_guests: number;
  active: boolean;
  description?: string;
}

// Customer
export interface QloAppsCustomer {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  active: boolean;
}

// Booking
export interface QloAppsBooking {
  id: number;
  id_customer: number;
  booking_status: 1 | 2 | 3 | 4;
  payment_status: 1 | 2 | 3;
  total_price: number;
  currency: string;
  source?: string;
  channel?: string;
  room_types: QloAppsBookingRoomType[];
  customer_detail: QloAppsBookingCustomer;
  date_add?: string;
  date_upd?: string;
}

export interface QloAppsBookingRoomType {
  id_room_type: number;
  date_from: string; // YYYY-MM-DD
  date_to: string;   // YYYY-MM-DD
  number_of_rooms: number;
  id_room?: number;
  occupancy: QloAppsOccupancy[];
}

export interface QloAppsOccupancy {
  adults: number;
  children: number;
  child_ages: number[];
}

export interface QloAppsBookingCustomer {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  country_code?: string;
  state_code?: string;
  zip?: string;
}

// API Responses
export interface QloAppsListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface QloAppsCreateResponse {
  id: number;
}

// Sync types
export interface QloAppsSyncResult {
  success: boolean;
  syncedItems: number;
  createdItems: number;
  updatedItems: number;
  failedItems: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}
```

**Agent Instructions:**
1. Create comprehensive type definitions
2. Follow pattern from `src/integrations/beds24/beds24_types.ts`
3. Include JSDoc comments for complex types
4. Export all types from index

---

### Task 2.3: Create QloApps Client

**File:** `src/integrations/qloapps/qloapps_client.ts`

**Description:** HTTP client for QloApps WebService API.

**Class Structure:**
```typescript
export class QloAppsClient {
  private client: AxiosInstance;
  private config: QloAppsConfig;

  constructor(config: QloAppsConfig);

  // Room Types
  async getRoomTypes(): Promise<QloAppsRoomType[]>;
  async getRoomType(id: number): Promise<QloAppsRoomType | null>;
  
  // Bookings
  async getBookings(params: GetBookingsParams): Promise<QloAppsBooking[]>;
  async getBooking(id: number): Promise<QloAppsBooking | null>;
  async createBooking(booking: CreateBookingRequest): Promise<number>;
  async updateBooking(id: number, updates: UpdateBookingRequest): Promise<boolean>;
  async cancelBooking(id: number): Promise<boolean>;
  
  // Customers
  async getCustomer(id: number): Promise<QloAppsCustomer | null>;
  async findCustomerByEmail(email: string): Promise<QloAppsCustomer | null>;
  async createCustomer(customer: CreateCustomerRequest): Promise<number>;
  async updateCustomer(id: number, updates: UpdateCustomerRequest): Promise<boolean>;
  
  // Availability & Rates (if supported by QloApps API)
  async updateAvailability(roomTypeId: number, dates: AvailabilityUpdate[]): Promise<boolean>;
  async updateRates(roomTypeId: number, dates: RateUpdate[]): Promise<boolean>;
  
  // Connection test
  async testConnection(): Promise<{ success: boolean; message: string; hotelName?: string }>;
  
  // Helper methods
  private buildRequestHeaders(): Record<string, string>;
  private handleError(operation: string, error: unknown): Error;
  private parseResponse<T>(data: unknown): T;
}
```

**Key Implementation Notes:**
- Use Axios with Basic Auth (API key as username, empty password)
- Set `Output-Format: JSON` header for JSON responses
- Implement exponential backoff for retries
- Log all requests/responses for debugging
- Handle both XML and JSON responses (QloApps may return XML for some endpoints)

**Agent Instructions:**
1. Create client class following `beds24_client.ts` patterns
2. Implement proper authentication (API key as Basic Auth username)
3. Handle QloApps-specific response formats
4. Add comprehensive error handling with custom error classes
5. Implement rate limiting to respect API limits

---

### Task 2.4: Create QloApps Error Classes

**File:** `src/integrations/qloapps/qloapps_errors.ts`

**Description:** Custom error classes for QloApps integration.

**Implementation:**
```typescript
export class QloAppsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'QloAppsError';
  }
}

export class QloAppsAuthenticationError extends QloAppsError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'QloAppsAuthenticationError';
  }
}

export class QloAppsNotFoundError extends QloAppsError {
  constructor(resource: string, id: number | string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'QloAppsNotFoundError';
  }
}

export class QloAppsValidationError extends QloAppsError {
  constructor(message: string, public readonly validationErrors?: string[]) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'QloAppsValidationError';
  }
}

export class QloAppsRateLimitError extends QloAppsError {
  constructor(retryAfter?: number) {
    super(`Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`, 'RATE_LIMIT', 429);
    this.name = 'QloAppsRateLimitError';
  }
}

export class QloAppsConnectionError extends QloAppsError {
  constructor(message: string = 'Failed to connect to QloApps') {
    super(message, 'CONNECTION_ERROR');
    this.name = 'QloAppsConnectionError';
  }
}
```

**Agent Instructions:**
1. Follow pattern from `beds24_errors.ts`
2. Create error classes for all expected error scenarios
3. Include error codes for programmatic handling

---

## Phase 3: Sync Services

### Task 3.1: Create Data Mappers

**Files:**
- `src/integrations/qloapps/mappers/room_type_mapper.ts`
- `src/integrations/qloapps/mappers/reservation_mapper.ts`
- `src/integrations/qloapps/mappers/guest_mapper.ts`
- `src/integrations/qloapps/mappers/index.ts`

**Description:** Transform data between PMS and QloApps formats.

**Room Type Mapper:**
```typescript
export class RoomTypeMapper {
  // PMS → QloApps
  static toQloApps(roomType: PMSRoomType): QloAppsRoomTypeCreate {
    return {
      name: roomType.name,
      price: parseFloat(roomType.price_per_night.toString()),
      max_adults: roomType.max_adult || roomType.max_people || 2,
      max_children: roomType.max_children || 0,
      description: roomType.description || '',
      active: roomType.deleted_at === null,
    };
  }
  
  // QloApps → PMS
  static fromQloApps(roomType: QloAppsRoomType): Partial<PMSRoomType> {
    return {
      name: roomType.name,
      price_per_night: roomType.price,
      max_adult: roomType.max_adults,
      max_children: roomType.max_children,
      max_people: roomType.max_guests,
      description: roomType.description,
    };
  }
}
```

**Reservation Mapper:**
```typescript
export class ReservationMapper {
  // PMS → QloApps
  static toQloApps(
    reservation: PMSReservation,
    guest: PMSGuest,
    roomTypeMapping: RoomTypeMapping
  ): QloAppsBookingCreate {
    return {
      booking_status: this.mapStatusToQloApps(reservation.status),
      payment_status: QLOAPPS_CONFIG.PAYMENT_STATUS.COMPLETED,
      currency: 'USD', // Get from hotel settings
      customer_detail: GuestMapper.toQloAppsCustomer(guest),
      room_types: [{
        id_room_type: roomTypeMapping.qloapps_product_id,
        date_from: formatDate(reservation.check_in),
        date_to: formatDate(reservation.check_out),
        number_of_rooms: 1,
        occupancy: [{
          adults: reservation.adults || 2,
          children: reservation.children || 0,
          child_ages: [],
        }],
      }],
    };
  }
  
  // QloApps → PMS
  static fromQloApps(
    booking: QloAppsBooking,
    roomTypeMapping: RoomTypeMapping | null
  ): Partial<PMSReservation> {
    const roomType = booking.room_types[0]; // Primary room type
    return {
      room_type_id: roomTypeMapping?.local_room_type_id,
      check_in: new Date(roomType.date_from),
      check_out: new Date(roomType.date_to),
      status: this.mapStatusFromQloApps(booking.booking_status),
      total_amount: booking.total_price,
      source: this.mapSourceFromQloApps(booking.source, booking.channel),
    };
  }
  
  private static mapStatusToQloApps(status: string): 1 | 2 | 3 | 4 {
    switch (status) {
      case 'Confirmed': return 1; // NEW
      case 'Checked-in': return 2; // COMPLETED
      case 'Checked-out': return 2; // COMPLETED
      case 'Cancelled': return 3; // CANCELLED
      default: return 1;
    }
  }
  
  private static mapStatusFromQloApps(status: 1 | 2 | 3 | 4): string {
    switch (status) {
      case 1: return 'Confirmed';
      case 2: return 'Checked-out';
      case 3: return 'Cancelled';
      case 4: return 'Cancelled'; // Refunded treated as cancelled
      default: return 'Confirmed';
    }
  }
  
  private static mapSourceFromQloApps(source?: string, channel?: string): string {
    if (channel) {
      // OTA booking through channel manager
      if (channel.toLowerCase().includes('booking')) return 'Booking.com';
      if (channel.toLowerCase().includes('expedia')) return 'Expedia';
      if (channel.toLowerCase().includes('airbnb')) return 'Airbnb';
      return 'QloApps';
    }
    return source === 'webservice' ? 'Direct' : 'QloApps';
  }
}
```

**Agent Instructions:**
1. Create mapper classes in `src/integrations/qloapps/mappers/`
2. Follow existing mapper patterns from Beds24 integration
3. Handle all edge cases and null values
4. Add comprehensive unit tests for mappers

---

### Task 3.2: Implement Inbound Reservation Sync Service

**File:** `src/integrations/qloapps/services/inbound_reservation_sync.ts`

**Description:** Pull reservations from QloApps and create/update in PMS.

**Class Structure:**
```typescript
export class InboundReservationSyncService {
  constructor(
    private client: QloAppsClient,
    private db: Knex,
    private hotelId: string
  );

  async sync(options?: {
    fullSync?: boolean;
    since?: Date;
    limit?: number;
  }): Promise<QloAppsSyncResult>;
  
  private async getLastSyncTime(): Promise<Date | null>;
  private async processBooking(booking: QloAppsBooking): Promise<void>;
  private async findOrCreateGuest(customer: QloAppsBookingCustomer): Promise<string>;
  private async findRoomTypeMapping(qloAppsRoomTypeId: number): Promise<RoomTypeMapping | null>;
  private async createReservation(booking: QloAppsBooking, guestId: string, roomTypeId: string): Promise<string>;
  private async updateReservation(reservationId: string, booking: QloAppsBooking): Promise<void>;
  private async handleConflict(localRes: Reservation, qloAppsBooking: QloAppsBooking): Promise<void>;
  private async updateSyncState(result: QloAppsSyncResult): Promise<void>;
}
```

**Sync Logic:**
1. Get last successful sync timestamp
2. Fetch bookings from QloApps modified since last sync
3. For each booking:
   - Check if mapping exists
   - If exists: compare timestamps, update if QloApps is newer
   - If not exists: create reservation + mapping
4. Handle guest matching/creation
5. Log all operations
6. Update sync state

**Agent Instructions:**
1. Create service following `pull_sync_service.ts` pattern from Beds24
2. Implement incremental sync using `date_upd` from QloApps
3. Use database transactions for atomicity
4. Handle conflicts with configurable resolution strategy
5. Log detailed sync operations to `qloapps_sync_logs`

---

### Task 3.3: Implement Outbound Reservation Sync Service

**File:** `src/integrations/qloapps/services/outbound_reservation_sync.ts`

**Description:** Push PMS reservations to QloApps.

**Class Structure:**
```typescript
export class OutboundReservationSyncService {
  constructor(
    private client: QloAppsClient,
    private db: Knex,
    private hotelId: string
  );

  // Sync single reservation (used by hooks)
  async syncReservation(reservationId: string): Promise<QloAppsSyncResult>;
  
  // Batch sync all pending outbound changes
  async syncPending(): Promise<QloAppsSyncResult>;
  
  private async getReservationWithGuest(id: string): Promise<ReservationWithGuest>;
  private async findOrCreateQloAppsCustomer(guest: Guest): Promise<number>;
  private async createQloAppsBooking(reservation: ReservationWithGuest): Promise<number>;
  private async updateQloAppsBooking(qloAppsOrderId: number, reservation: ReservationWithGuest): Promise<void>;
}
```

**Agent Instructions:**
1. Create service for pushing reservations to QloApps
2. Implement both single-reservation and batch sync
3. Handle customer creation in QloApps if not mapped
4. Update mapping table after successful sync
5. Implement retry logic for failed syncs

---

### Task 3.4: Implement Outbound Availability Sync

**File:** `src/integrations/qloapps/services/availability_sync.ts`

**Description:** Push availability updates to QloApps.

**Implementation Notes:**
- Calculate availability from: total_units - booked_units - maintenance
- Sync for next 365 days by default
- Batch updates to reduce API calls
- Trigger on: reservation create/update/cancel, room maintenance

**Agent Instructions:**
1. Create availability calculation logic
2. Integrate with QloApps availability API (if available)
3. If no direct availability API, create bookings to block dates
4. Implement efficient date range updates

---

### Task 3.5: Implement Guest Matching Service

**File:** `src/integrations/qloapps/services/guest_matching_service.ts`

**Description:** Match guests between PMS and QloApps using email, phone, or name.

**Matching Strategy:**
1. Exact email match (highest confidence)
2. Exact phone match (high confidence)
3. Name + partial match (lower confidence)
4. Create new if no match

**Agent Instructions:**
1. Implement matching algorithm with confidence scores
2. Store match method in mapping table
3. Handle edge cases (missing email, phone formatting)
4. Allow manual override of matches

---

## Phase 4: API Routes

### Task 4.1: Create QloApps Routes

**File:** `src/services/qloapps/routes.ts`

**Description:** REST API endpoints for QloApps integration management.

**Endpoints:**
```typescript
// Configuration
GET    /api/qloapps/config         - Get current configuration
POST   /api/qloapps/config         - Save configuration
POST   /api/qloapps/test-connection - Test API connection

// Manual Sync
POST   /api/qloapps/sync           - Trigger manual sync
POST   /api/qloapps/sync/reservations/inbound  - Sync inbound reservations
POST   /api/qloapps/sync/reservations/outbound - Sync outbound reservations
POST   /api/qloapps/sync/room-types            - Sync room types

// Mappings
GET    /api/qloapps/mappings/room-types     - List room type mappings
POST   /api/qloapps/mappings/room-types     - Create room type mapping
DELETE /api/qloapps/mappings/room-types/:id - Delete room type mapping

GET    /api/qloapps/mappings/reservations   - List reservation mappings
GET    /api/qloapps/mappings/customers      - List customer mappings

// Logs & Status
GET    /api/qloapps/sync-logs      - Get sync logs
GET    /api/qloapps/sync-status    - Get current sync status
GET    /api/qloapps/health         - Health check
```

**Agent Instructions:**
1. Create route file in `src/services/qloapps/`
2. Implement all endpoints with proper validation
3. Add authentication middleware
4. Follow existing route patterns from other services
5. Register routes in main `routes.ts`

---

### Task 4.2: Create QloApps Controller

**File:** `src/services/qloapps/controller.ts`

**Description:** Controller logic for QloApps routes.

**Agent Instructions:**
1. Create controller with all endpoint handlers
2. Inject dependencies (QloApps client, services)
3. Implement proper error handling
4. Return consistent response format

---

## Phase 5: Workers & Scheduling

### Task 5.1: Create Inbound Sync Worker

**File:** `src/workers/qloapps_inbound_worker.ts`

**Description:** Background worker for scheduled inbound sync.

**Implementation:**
```typescript
export class QloAppsInboundWorker {
  private isRunning: boolean = false;
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  
  private async runSyncCycle(): Promise<void>;
  private async acquireLock(): Promise<boolean>;
  private async releaseLock(): Promise<void>;
}
```

**Features:**
- Scheduled execution (every 5-15 minutes)
- Database-level locking to prevent overlaps
- Graceful shutdown handling
- Error notification on consecutive failures

**Agent Instructions:**
1. Create worker following existing worker patterns
2. Use node-cron or similar for scheduling
3. Implement proper locking mechanism
4. Add health check endpoint integration

---

### Task 5.2: Create Outbound Sync Worker

**File:** `src/workers/qloapps_outbound_worker.ts`

**Description:** Process outbound sync queue.

**Implementation:**
- Consume from outbound sync queue (RabbitMQ or Bull)
- Process reservation, availability, and rate updates
- Retry failed items with exponential backoff

**Agent Instructions:**
1. Create queue consumer worker
2. Integrate with existing RabbitMQ setup
3. Implement retry logic with dead letter queue

---

### Task 5.3: Create Event Hooks

**File:** `src/integrations/qloapps/hooks/reservation_hooks.ts`

**Description:** Event hooks to trigger real-time outbound sync.

**Events to Hook:**
- `reservation.created` → Queue outbound reservation sync
- `reservation.updated` → Queue outbound reservation sync
- `reservation.cancelled` → Queue outbound reservation sync
- `room_type.updated` → Queue outbound availability sync
- `rate.updated` → Queue outbound rate sync

**Agent Instructions:**
1. Create event hooks following existing hook patterns
2. Integrate with reservation service events
3. Queue jobs instead of direct sync (async processing)

---

## Phase 6: Testing & Validation

### Task 6.1: Unit Tests

**Files:**
- `src/integrations/qloapps/__tests__/client.test.ts`
- `src/integrations/qloapps/__tests__/mappers.test.ts`
- `src/integrations/qloapps/__tests__/services.test.ts`

**Test Coverage:**
- Client methods (mock HTTP responses)
- Data mappers (edge cases, null handling)
- Sync services (mock DB and client)

**Agent Instructions:**
1. Create comprehensive unit tests
2. Use Jest with proper mocking
3. Aim for >80% code coverage

---

### Task 6.2: Integration Tests

**Description:** Test against QloApps demo instance.

**QloApps Demo:**
- URL: https://demo.qloapps.com
- Email: demo@demo.com
- Password: demodemo

**Test Scenarios:**
1. Connection test with valid/invalid API key
2. Fetch room types
3. Create, update, cancel booking
4. Fetch bookings with filters

**Agent Instructions:**
1. Create integration test suite
2. Use QloApps demo for testing
3. Ensure tests are idempotent (clean up created data)

---

### Task 6.3: End-to-End Sync Tests

**Scenarios:**
1. Initial room type sync from QloApps
2. Create reservation in PMS → appears in QloApps
3. Create booking in QloApps → appears in PMS
4. Update reservation in PMS → updated in QloApps
5. Cancel booking in QloApps → cancelled in PMS
6. Conflict resolution test

**Agent Instructions:**
1. Create E2E test scenarios
2. Test full sync cycle
3. Verify data integrity after sync

---

## 7. Risk Mitigation

### Risk 1: QloApps API Rate Limits
- **Mitigation:** Implement rate limiting in client (60 req/min default)
- **Fallback:** Exponential backoff on 429 responses

### Risk 2: API Changes/Breaking Changes
- **Mitigation:** Version QloApps API calls, monitor changelog
- **Fallback:** Integration tests run on QloApps demo

### Risk 3: Data Conflicts
- **Mitigation:** Timestamp-based conflict detection
- **Fallback:** Manual conflict resolution queue

### Risk 4: Network Failures
- **Mitigation:** Retry logic with exponential backoff
- **Fallback:** Store failed items for later retry

### Risk 5: QloApps Downtime
- **Mitigation:** Circuit breaker pattern
- **Fallback:** Queue operations for later processing

---

## 8. Success Criteria

### Functional Requirements
- [ ] Room types sync bidirectionally between PMS and QloApps
- [ ] Reservations from QloApps (OTAs) appear in PMS within 5 minutes
- [ ] Direct bookings in PMS appear in QloApps within 5 minutes
- [ ] Availability updates reflect in QloApps
- [ ] Rate changes reflect in QloApps
- [ ] Guest data synced with reservations

### Non-Functional Requirements
- [ ] Sync latency < 5 minutes for inbound, < 2 minutes for outbound
- [ ] Zero data loss during sync
- [ ] Graceful handling of API failures
- [ ] Comprehensive logging for debugging
- [ ] Admin UI for configuration and monitoring

### Integration Quality
- [ ] Unit test coverage > 80%
- [ ] Integration tests passing
- [ ] No regression in existing Beds24 integration
- [ ] Documentation complete

---

## Appendix A: File Structure

```
src/integrations/qloapps/
├── __tests__/
│   ├── client.test.ts
│   ├── mappers.test.ts
│   └── services.test.ts
├── hooks/
│   └── reservation_hooks.ts
├── mappers/
│   ├── guest_mapper.ts
│   ├── index.ts
│   ├── reservation_mapper.ts
│   └── room_type_mapper.ts
├── repositories/
│   ├── config_repository.ts
│   ├── mapping_repository.ts
│   └── sync_state_repository.ts
├── services/
│   ├── availability_sync.ts
│   ├── guest_matching_service.ts
│   ├── inbound_reservation_sync.ts
│   ├── outbound_reservation_sync.ts
│   └── room_type_sync.ts
├── index.ts
├── qloapps_client.ts
├── qloapps_config.ts
├── qloapps_errors.ts
└── qloapps_types.ts

src/services/qloapps/
├── controller.ts
├── routes.ts
└── index.ts

src/workers/
├── qloapps_inbound_worker.ts
└── qloapps_outbound_worker.ts

src/database/migrations/
├── YYYYMMDD_create_qloapps_config.ts
├── YYYYMMDD_create_qloapps_room_type_mappings.ts
├── YYYYMMDD_create_qloapps_reservation_mappings.ts
├── YYYYMMDD_create_qloapps_customer_mappings.ts
├── YYYYMMDD_create_qloapps_sync_state.ts
└── YYYYMMDD_create_qloapps_sync_logs.ts
```

---

## Appendix B: QloApps Setup Requirements

### QloApps Instance Setup
1. Install QloApps (https://qloapps.com/download/)
2. Configure hotel with room types
3. Enable WebService API:
   - Admin → Advanced Parameters → Webservice
   - Enable webservice
   - Add API key with permissions:
     - `bookings`: GET, POST, PUT
     - `room_types`: GET
     - `customers`: GET, POST, PUT
     - `hotels`: GET
     - `hotel_booking_detail`: GET
4. Install Channel Manager addon (for OTA connections)
5. Configure OTA channels in Channel Manager

### API Key Permissions
| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| bookings | ✅ | ✅ | ✅ | ❌ |
| room_types | ✅ | ❌ | ❌ | ❌ |
| customers | ✅ | ✅ | ✅ | ❌ |
| hotels | ✅ | ❌ | ❌ | ❌ |
| orders | ✅ | ❌ | ❌ | ❌ |

---

## Appendix C: Status Code Reference

### PMS Reservation Status
| Status | Description |
|--------|-------------|
| Confirmed | Booking confirmed, not yet checked in |
| Checked-in | Guest has checked in |
| Checked-out | Guest has checked out |
| Cancelled | Booking was cancelled |

### QloApps Booking Status
| Code | Name | Description |
|------|------|-------------|
| 1 | NEW | New booking |
| 2 | COMPLETED | Completed/checked out |
| 3 | CANCELLED | Cancelled |
| 4 | REFUNDED | Refunded |

### QloApps Payment Status
| Code | Name | Description |
|------|------|-------------|
| 1 | COMPLETED | Fully paid |
| 2 | PARTIAL | Partial payment |
| 3 | AWAITING | Awaiting payment |

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| **PMS** | Property Management System (your system) |
| **QloApps** | Open-source hotel management system used as broker |
| **Channel Manager** | QloApps addon that connects to OTAs |
| **OTA** | Online Travel Agency (Booking.com, Expedia, etc.) |
| **Inbound Sync** | Data flowing from QloApps to PMS |
| **Outbound Sync** | Data flowing from PMS to QloApps |
| **Room Type** | Category of room (in QloApps: Product) |
| **Booking** | Reservation in QloApps |
| **Order** | QloApps order entity containing booking |
| **WebService** | QloApps REST API |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2026 | System | Initial plan created |

