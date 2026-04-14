# Integration API Contract Surface: QloApps Channel Manager

**Feature**: Phase 0 PMS Baseline  
**Date**: 2026-04-14  
**Base path**: `/api/v1/qloapps`  
**Note**: `docs/USE_CASES.md` refers to this integration as "Beds24". The implementation
targets QloApps. This naming must be aligned in Phase 1.

---

## 1. Configuration and Health

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/qloapps/config` | Get QloApps connection config | ✅ Implemented | UC-1008 |
| PUT | `/api/v1/qloapps/config` | Save QloApps settings | ✅ Implemented | UC-1008 |
| POST | `/api/v1/qloapps/config/test` | Test QloApps connection | ✅ Implemented | — |
| GET | `/api/v1/qloapps/health` | Integration health summary | ⚠️ Partial | Queue depth metric TODO |

**Config payload**:
```json
{
  "base_url": "https://qloapps.example.com",
  "api_key": "string (stored encrypted)",
  "hotel_id": "string"
}
```

---

## 2. Sync Operations

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| POST | `/api/v1/qloapps/sync/trigger` | Trigger manual sync | ⚠️ Partial | UC-1007; only `full` and `reservations_inbound` types complete |
| GET | `/api/v1/qloapps/sync/status` | Get sync status | ✅ Implemented | UC-1006 |
| GET | `/api/v1/qloapps/sync/logs` | Get sync operation logs | ✅ Implemented | UC-1006 |
| GET | `/api/v1/qloapps/sync/errors` | Get sync error records | ✅ Implemented | — |

**Sync types available**: `full`, `reservations_inbound`  
**⚠️ Missing sync types**: `availability`, `rates`, `room_types` — outbound services are
placeholder implementations (see `integration-api.md` gap notes below)

---

## 3. Entity Mappings

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/qloapps/mappings/room-types` | List room-type mappings | ✅ Implemented | — |
| POST | `/api/v1/qloapps/mappings/room-types` | Create room-type mapping | ✅ Implemented | — |
| PUT | `/api/v1/qloapps/mappings/room-types/:id` | Update mapping | ✅ Implemented | — |
| DELETE | `/api/v1/qloapps/mappings/room-types/:id` | Remove mapping | ✅ Implemented | — |
| GET | `/api/v1/qloapps/mappings/reservations` | List reservation mappings | ✅ Implemented | — |
| GET | `/api/v1/qloapps/mappings/customers` | List customer mappings | ✅ Implemented | — |

---

## 4. Conflict Resolution

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/qloapps/conflicts` | List unresolved sync conflicts | ✅ Implemented | UC-1005 |
| PUT | `/api/v1/qloapps/conflicts/:id/resolve` | Resolve conflict (keep local/remote) | ⚠️ Partial | `applyDirection` logic incomplete (TODO in controller) |

---

## 5. Async Worker Architecture

The integration uses RabbitMQ-backed async workers. These are not HTTP endpoints but are
documented here for contract completeness.

| Worker | Responsibility | Status |
|---|---|---|
| `worker-inbound` | Consume QloApps-originating events; create/update reservations locally | ✅ Implemented |
| `worker-outbound` | Consume local PMS change events; push to QloApps API | ⚠️ Partial — outbound availability/rate push are placeholders |
| `worker-scheduler` | Periodic pull-sync from QloApps on schedule | ✅ Implemented (schedule trigger) |

**Queue topology** (`backend/src/integrations/qloapps/queue/rabbitmq_topology.ts`):

| Exchange / Queue | Purpose |
|---|---|
| `qloapps.events` (exchange) | Routes outbound PMS-change events |
| `qloapps.inbound` | Inbound events from QloApps |
| `qloapps.outbound` | Outbound sync jobs to QloApps |
| `qloapps.inbound.dlq` | Dead-letter queue for inbound failures |
| `qloapps.outbound.dlq` | Dead-letter queue for outbound failures |

**Idempotency**: Sync jobs carry reservation/entity IDs; workers use mapping tables to
detect already-synced records. Full idempotency coverage needs verification in Phase 3.

---

## 6. Event Hooks (PMS → Queue)

Local PMS actions that trigger outbound sync jobs (`backend/src/integrations/qloapps/hooks/sync_hooks.ts`):

| PMS Action | Sync Event Queued |
|---|---|
| Reservation created | `reservation.created` → outbound sync |
| Reservation updated | `reservation.updated` → outbound sync |
| Reservation cancelled | `reservation.cancelled` → outbound sync |
| Guest created/updated | `guest.created/updated` → customer mapping sync |
| Room type updated | `room_type.updated` → room-type push (⚠️ placeholder) |
| Check-in | `check_in.created` → outbound status sync |
| Check-out | `check_out.created` → outbound status sync |

---

## 7. Known Integration Gaps (Phase 3 Work)

| Gap | Root Cause | Impact |
|---|---|---|
| Availability push to QloApps | `availability_sync_service.ts` is placeholder | OTA availability not updated from PMS |
| Rate push to QloApps | `rate_sync_service.ts` is placeholder | OTA rates not updated from PMS |
| Room-type push create/update | Skipped due to QloApps API limitations | New room types not propagated to QloApps |
| Conflict `applyDirection` | TODO in `qloapps_controller.ts` | Conflict resolution requires manual workaround |
| Queue depth health metric | TODO in `qloapps_controller.ts` | Health endpoint incomplete |
| Full idempotency audit | Not fully evidenced | Retry storms may cause duplicate records |
| USE_CASES.md naming | References Beds24 throughout | Causes documentation confusion |
