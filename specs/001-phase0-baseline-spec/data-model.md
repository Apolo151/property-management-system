# Data Model: Phase 0 As-Built Entity Model

**Feature**: Phase 0 PMS Baseline  
**Branch**: `001-phase0-baseline-spec`  
**Date**: 2026-04-14  
**Source of truth**: Actual Knex migration files in `backend/src/database/migrations/`  
**Note**: This document captures the *as-built* model reflecting the **multi-property** design.
Where `docs/DATABASE_SCHEMA.md` previously described a single-hotel system, that was inaccurate.
The actual migrations implement full multi-property tenancy. Drift items are flagged with ⚠️.

---

## Entity Overview

```text
┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐
│   hotels    │◄───│   user_hotels    │───►│      users         │
│  (tenants)  │    │  (assignments)   │    │  (RBAC, 7 roles)   │
└─────────────┘    └──────────────────┘    └────────────────────┘
       │
       │  (hotel scoping via X-Hotel-Id context)
       ▼
┌──────────────┐    ┌──────────────────┐
│  room_types  │───►│     rooms        │
│ (inventory)  │    │  (status + hkp)  │
└──────────────┘    └──────────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    guests    │    │  reservations    │───►│  reservation_    │
│ (CRM-lite)  │◄───│  (lifecycle)     │    │    guests        │
└──────────────┘    └──────────────────┘    └──────────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ guest_notes  │    │    check_ins     │    │    invoices      │
└──────────────┘    │ (check-in/out/  │    │  (billing state) │
                    │  room change)   │    └──────────────────┘
                    └──────────────────┘           │
                                                   ▼
                                          ┌──────────────────┐
                                          │    payments      │
                                          │ (transactions)   │
                                          └──────────────────┘

┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ housekeeping │    │  maintenance_    │    │    expenses      │
│  (1-to-1    │    │   requests       │    │  + categories    │
│   with room)│    └──────────────────┘    └──────────────────┘
└──────────────┘

┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  audit_logs  │    │  notifications   │    │  qloapps_config  │
└──────────────┘    └──────────────────┘    │  qloapps_sync_   │
                                            │  logs/mappings   │
                                            └──────────────────┘
```

---

## Entity Definitions

### hotels *(multi-property root)*

The core multi-property tenant table. Each hotel is an independently scoped operational
entity. All PMS data (rooms, guests, reservations, etc.) belongs to a hotel via `hotel_id` FK.
Previously undocumented in `docs/DATABASE_SCHEMA.md`; now the canonical system design.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | Hotel display name |
| address | TEXT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

---

### hotel_settings *(per-property configuration)*

Per-property configuration table. Each hotel has its own settings record (check-in time,
currency, tax rate, etc.). Previously documented as a singleton with a fixed UUID — the
correct design is one settings record per hotel, linked by `hotel_id`.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | Each hotel has its own settings record |
| hotel_name | VARCHAR(255) | |
| address, city, country | TEXT/VARCHAR | |
| phone, email | VARCHAR | |
| tax_rate | DECIMAL(5,2) | Default 0.00 |
| currency | VARCHAR(10) | Default `USD` |
| timezone | VARCHAR(50) | Default `UTC` |
| check_in_time | TIME | Default `15:00` |
| check_out_time | TIME | Default `11:00` |
| settings | JSONB | Flexible additional config |

---

### users

Seven-role user accounts with bcrypt password and JWT refresh token storage.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | Login identifier |
| password_hash | VARCHAR(255) | bcrypt |
| first_name, last_name | VARCHAR(100) | |
| role | VARCHAR(50) CHECK | `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `VIEWER` |
| is_active | BOOLEAN | Default true |
| last_login | TIMESTAMP | |
| refresh_token | TEXT | JWT refresh token (rotated) |
| refresh_token_expires_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

---

### user_hotels *(property assignments)*

Joins users to hotel properties, enabling a user to operate across multiple hotels with
the same account. Previously undocumented; now a first-class entity in the multi-property model.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | |
| hotel_id | UUID FK → hotels | |
| created_at | TIMESTAMP | |

---

### room_types *(inventory unit abstraction)*

⚠️ Not in `docs/DATABASE_SCHEMA.md` (which uses simple `rooms.type` enum instead). The
actual codebase introduced a `room_types` table as an inventory management layer between
room configuration and individual physical rooms.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | Hotel-scoped |
| name | VARCHAR(255) | e.g., `Deluxe Double` |
| description | TEXT | |
| base_price | DECIMAL(10,2) | Base nightly rate |
| max_occupancy | INTEGER | |
| amenities | JSONB | |
| total_units | INTEGER | Count of physical rooms of this type |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Gap vs DATABASE_SCHEMA.md**: Schema doc defines `rooms.type` as `CHECK (type IN ('Single','Double','Suite'))` but the actual service uses `room_types` as a separate entity, which is richer and more extensible. Phase 1 ERD v2 must canonicalize this.

---

### rooms

Physical room records. Status drives operational workflows.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | Hotel-scoped |
| room_type_id | UUID FK → room_types | ⚠️ Present in migrations, absent in schema doc |
| room_number | VARCHAR(50) UNIQUE | e.g., `101`, `202` |
| status | VARCHAR(50) CHECK | `Available`, `Occupied`, `Cleaning`, `Out of Service` |
| floor | INTEGER | |
| features | JSONB | Array of feature strings |
| description | TEXT | |
| created_at / updated_at | TIMESTAMP | |

**State transitions**:
```
Available → Occupied (on check-in)
Occupied → Cleaning (on check-out)
Cleaning → Available (housekeeping marks clean)
Available / Cleaning → Out of Service (admin action)
Out of Service → Available (admin resolution)
```

---

### room_features *(normalized features)*

Normalized feature tags per room for query efficiency.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms CASCADE | |
| feature_name | VARCHAR(100) | e.g., `WiFi`, `AC`, `Balcony` |
| UNIQUE(room_id, feature_name) | | |

---

### guests

Guest CRM-lite profiles. Hotel-scoped. Soft-deletable.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | ⚠️ Hotel-scoped in migrations, absent in schema doc |
| name | VARCHAR(255) | Full name |
| email | VARCHAR(255) | |
| phone | VARCHAR(50) | |
| past_stays | INTEGER | Denormalized count |
| notes | TEXT | Inline notes |
| preferences | JSONB | Room preferences etc. |
| deleted_at | TIMESTAMP | Soft delete |

---

### guest_notes

Structured per-author notes on a guest profile.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| guest_id | UUID FK → guests CASCADE | |
| created_by_id | UUID FK → users SET NULL | |
| note | TEXT | |
| created_at | TIMESTAMP | |

---

### reservations

Core booking record linking a room to a guest for a date range.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | ⚠️ Hotel-scoped, absent in schema doc |
| room_id | UUID FK → rooms RESTRICT | |
| primary_guest_id | UUID FK → guests RESTRICT | |
| check_in | DATE | |
| check_out | DATE | |
| status | VARCHAR(50) CHECK | `Confirmed`, `Checked-in`, `Checked-out`, `Cancelled` |
| total_amount | DECIMAL(10,2) | |
| source | VARCHAR(50) CHECK | `Direct`, `Beds24` ⚠️, `Booking.com`, `Expedia`, `Other` |
| beds24_booking_id | VARCHAR(255) | ⚠️ Column name should be `qloapps_booking_id` post-migration |
| special_requests | TEXT | |
| deleted_at | TIMESTAMP | Soft delete |

**Overlap prevention**: Partial unique index on `(room_id, check_in, check_out)` WHERE
`status != 'Cancelled' AND deleted_at IS NULL`.

**⚠️ Drift**: `source` enum and `beds24_booking_id` column name reference Beds24 but the
integration is now QloApps. These need rename/extend in Phase 1 ERD v2.

---

### reservation_guests

Junction table for multi-guest reservations (double rooms).

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| reservation_id | UUID FK → reservations CASCADE | |
| guest_id | UUID FK → guests RESTRICT | |
| guest_type | VARCHAR(50) CHECK | `Primary`, `Secondary` |
| UNIQUE(reservation_id, guest_id) | | |

---

### check_ins *(application-layer lifecycle)*

⚠️ Not in `docs/DATABASE_SCHEMA.md`. The actual codebase has a dedicated `check_ins` service
and corresponding table tracking the operational check-in record separately from reservation
status.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| reservation_id | UUID FK → reservations | |
| room_id | UUID FK → rooms | Assigned physical room |
| guest_id | UUID FK → guests | Primary guest at check-in |
| checked_in_at | TIMESTAMP | |
| checked_out_at | TIMESTAMP | NULL until checkout |
| status | VARCHAR(50) CHECK | `Active`, `Checked-out` |
| notes | TEXT | Check-in/out notes |
| created_at / updated_at | TIMESTAMP | |

---

### invoices

Billing document linked to reservation and guest.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK → hotels | ⚠️ Hotel-scoped |
| reservation_id | UUID FK → reservations SET NULL | |
| guest_id | UUID FK → guests RESTRICT | |
| issue_date | DATE | |
| due_date | DATE | ≥ issue_date |
| amount | DECIMAL(10,2) | |
| status | VARCHAR(50) CHECK | `Pending`, `Paid`, `Cancelled`, `Overdue` |
| payment_method | VARCHAR(50) CHECK | `Cash`, `Card`, `Online`, `Bank Transfer` |
| notes | TEXT | |
| paid_at | TIMESTAMP | Set when status → Paid |

---

### payments

Individual payment transaction records against an invoice.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| invoice_id | UUID FK → invoices CASCADE | |
| amount | DECIMAL(10,2) | |
| payment_method | VARCHAR(50) CHECK | `Cash`, `Card`, `Online`, `Bank Transfer` |
| transaction_id | VARCHAR(255) | External ref |
| paid_at | TIMESTAMP | |

---

### housekeeping

One-to-one with rooms. Tracks cleaning status and staff assignment.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| room_id | UUID FK → rooms UNIQUE CASCADE | One record per room |
| status | VARCHAR(50) CHECK | `Clean`, `Dirty`, `In Progress` |
| assigned_staff_id | UUID FK → users SET NULL | |
| last_cleaned | TIMESTAMP | |
| notes | TEXT | |

---

### maintenance_requests

Room-linked repair/issue tickets with priority and status lifecycle.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK | ⚠️ Hotel-scoping needs verification in service layer |
| room_id | UUID FK → rooms CASCADE | |
| assigned_to_id | UUID FK → users SET NULL | |
| title | VARCHAR(255) | |
| description | TEXT | |
| priority | VARCHAR(50) CHECK | `Low`, `Medium`, `High`, `Urgent` |
| status | VARCHAR(50) CHECK | `Open`, `In Progress`, `Repaired`, `Cancelled` |
| resolved_at | TIMESTAMP | Set when Repaired |

---

### expenses / expense_categories

Operational expense tracking with category classification.

**expenses**:

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| hotel_id | UUID FK | ⚠️ Hotel-scoping, verify in service |
| category | VARCHAR(100) | Free-text or from expense_categories |
| amount | DECIMAL(10,2) | |
| expense_date | DATE | |
| notes | TEXT | |
| receipt_url | TEXT | File path or URL |

**expense_categories**: id, name UNIQUE, description.

---

### audit_logs

Immutable compliance log for all create/update/delete/action events.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users SET NULL | |
| action | VARCHAR(100) | `CREATE`, `UPDATE`, `DELETE`, `CHECK_IN`, etc. |
| entity_type | VARCHAR(100) | Table/domain name |
| entity_id | UUID | Modified record id |
| before_state | JSONB | State before change |
| after_state | JSONB | State after change |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMP | |

**⚠️ Gap**: Reads in `audit_controller.ts` do not filter by hotel scope. Phase 4 hardening task.

---

### notifications

Per-user notification messages with type classification and read status.

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users CASCADE | |
| type | VARCHAR(50) CHECK | `checkin`, `checkout`, `invoice`, `cleaning`, `maintenance`, `system` |
| title | VARCHAR(255) | |
| message | TEXT | |
| link | VARCHAR(500) | Optional navigation target |
| is_read | BOOLEAN | Default false |
| created_at | TIMESTAMP | |

---

### QloApps Integration Tables *(⚠️ named `beds24_*` in DATABASE_SCHEMA.md)*

The integration tables track sync operations with QloApps channel manager.

**qloapps_config** (actual name may differ — verify in migrations):  
Stores QloApps connection settings (base URL, encrypted API key, hotel ID) per hotel.

**qloapps_sync / beds24_sync** ⚠️:  
Tracks individual sync operations: type (`PUSH`/`PULL`/`WEBHOOK`), status
(`Pending`/`Success`/`Failed`/`Conflict`), payload, error message.

**sync_logs**:  
Detailed per-operation log linked to a sync record: action, status, request/response payloads.

**qloapps_mappings** (room_type_mappings, reservation_mappings, customer_mappings):  
⚠️ These tables exist in `backend/src/integrations/qloapps/` but are absent from
`DATABASE_SCHEMA.md`. They store external-to-local entity ID mappings for idempotent sync.

---

## Schema Drift Summary

| Item | Schema Doc Says | Actual Codebase Has | Phase to Fix |
|---|---|---|---|
| `hotels` table | Not documented | Present (multi-property root — canonical design) | ✅ Now documented |
| `user_hotels` table | Not documented | Present (property assignments) | ✅ Now documented |
| `hotel_settings` | Documented as singleton (fixed UUID) | Per-property record, one per hotel | Phase 1 (ERD v2) |
| `room_types` table | Not present (`rooms.type` enum only) | Present (separate entity, richer model) | Phase 1 (ERD v2) |
| `rooms.room_type_id` FK | Not documented | Present | Phase 1 (ERD v2) |
| `check_ins` table | Not documented | Present (application-layer lifecycle) | Phase 1 (ERD v2) |
| `beds24_sync` table name | `beds24_sync` | QloApps-specific sync tables | Phase 1 (rename in docs) |
| `reservations.source` enum | Includes `Beds24` | Needs audit vs actual migration | Phase 1 |
| `reservations.beds24_booking_id` | `beds24_booking_id` | May be `qloapps_booking_id` | Phase 1 |
| Mapping tables | Not present | Present (`qloapps_*_mappings`) | Phase 1 (ERD v2) |
| Hotel scoping on guests/reservations/invoices/maintenance/expenses | Not present | Present as `hotel_id` FK | Phase 1 (ERD v2) |
| DB trigger for auto-invoice | Defined in schema doc | Application-layer in check_ins service (risk of duplication) | Phase 2 (verify) |
