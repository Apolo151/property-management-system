# Phase 0 Research: PMS Baseline Domain and Technical Analysis

**Feature**: Phase 0 PMS Baseline  
**Branch**: `001-phase0-baseline-spec`  
**Date**: 2026-04-14  
**Status**: Complete — all NEEDS CLARIFICATION items resolved

---

## 1. Domain: Business and Product Baseline

### 1.1 System Purpose and Scope

**Decision**: The PMS is a **multi-property** hotel management system, supporting multiple
independently operated hotel properties under a single platform. Core capabilities per property
include rooms, reservations, check-in/out, guest profiles, billing, housekeeping, maintenance,
reporting, and an optional external channel integration (QloApps) per hotel.

**Rationale**: The codebase already contains a `hotels` table, `user_hotels` join table, and
`hotelContext` middleware enforcing per-request hotel scoping via `X-Hotel-Id`. This is a
multi-tenant architecture where each hotel is a separate operational tenant. Earlier docs
(DATABASE_SCHEMA.md, USE_CASES.md) incorrectly described this as single-property — those
documents have been updated to reflect the correct multi-property design.

**Alternatives considered**: Locking to single-property — rejected because the actual
implementation, migrations, and route middleware already implement multi-property tenancy.

---

### 1.2 Actor and Role Model

**Decision**: Seven roles are defined and enforced: `SUPER_ADMIN`, `ADMIN`, `MANAGER`,
`FRONT_DESK`, `HOUSEKEEPING`, `MAINTENANCE`, `VIEWER`. Multi-hotel tenancy is an overlay
(user-hotel assignment table), not a multi-property redesign.

**Rationale**: Role constraint in `users.role` CHECK, `requireRole(...)` middleware in
`backend/src/services/auth/auth_middleware.ts`, and hotel context assignment in `user_hotels`.

**Risk**: `VIEWER` role is listed in USE_CASES actors but route-level access restriction
for viewer-specific flows needs validation across all service routes.

---

### 1.3 Core PMS Workflow Inventory (Capability Baseline)

**Decision**: The following domains are substantially implemented end-to-end:

| Domain | Status | Key Evidence |
|---|---|---|
| Authentication (login/refresh/RBAC) | Implemented | `backend/src/services/auth/*`, `frontend/src/pages/LoginPage.jsx` |
| Guest CRUD, notes, history | Implemented | `backend/src/services/guests/*`, `frontend/src/pages/GuestsPage.jsx` |
| Room/Room-type CRUD and availability | Implemented | `backend/src/services/rooms/*`, `frontend/src/pages/RoomsPage.jsx` |
| Reservation create/view/search/calendar | Implemented | `backend/src/services/reservations/*`, `frontend/src/pages/ReservationsPage.jsx` |
| Check-in/out/room-change lifecycle | Implemented | `backend/src/services/check_ins/*`, `frontend/src/pages/CheckInsPage.jsx` |
| Invoice create/view/mark-paid | Implemented | `backend/src/services/invoices/*`, `frontend/src/pages/InvoicesPage.jsx` |
| Expenses CRUD + categories | Implemented | `backend/src/services/expenses/*`, `frontend/src/pages/ExpensesPage.jsx` |
| Housekeeping status and assignment | Implemented | `backend/src/services/rooms/*` (housekeeping), `frontend/src/pages/RoomsPage.jsx` |
| Maintenance requests lifecycle | Implemented | `backend/src/services/maintenance/*`, `frontend/src/pages/MaintenancePage.jsx` |
| Dashboard KPIs and chart analytics | Implemented | `backend/src/services/reports/*`, `frontend/src/pages/DashboardPage.jsx` |
| Export reports (CSV/JSON) | Implemented | `frontend/src/pages/ReportsPage.jsx` |
| Audit logs view/search/filter | Implemented | `backend/src/services/audit/*`, `frontend/src/pages/AuditLogsPage.jsx` |
| Hotel settings and channel config UI | Implemented | `backend/src/services/settings/*`, `frontend/src/pages/SettingsPage.jsx` |

---

### 1.4 Core PMS Gap Inventory (Priority Classification)

**Decision**: Gaps are classified as Must (Phase 2 prerequisite), Should (Phase 2 target),
or Could (Phase 2 or later). See `docs/specs/00-gap-analysis.md` for full matrix.

**Must-fix gaps before Phase 2 delivery gate**:

| Use Case | Gap Type | Root Cause |
|---|---|---|
| UC-004: Reset Password | Missing flow | No password-reset token/UI/API lifecycle |
| UC-006: Manage User Roles | Security debt | `users_routes` missing `authenticateToken` middleware |
| UC-409: Auto-generate Invoice on Checkout | Partial reliability | Invoice creation path not fully transactionally verified |
| UC-1001-1008: Channel Integration Suite | Naming/scope drift | USE_CASES.md targets Beds24; implementation is QloApps |

**Should-fix in Phase 2**:
- UC-005 Change Password UI, UC-106 Merge Duplicate Guests, UC-303/304/311 reservation lifecycle
  completeness, UC-407 Invoice PDF, UC-506 Housekeeping Schedule view, UC-1101-1106 Notification
  automation

**Could defer to Phase 3+**:
- UC-207 Rate management depth, UC-808 Occupancy forecast model depth

---

## 2. Technical Context Resolution

### 2.1 Technology Stack Confirmation

**Decision**: No NEEDS CLARIFICATION items remain. Stack is fully confirmed from codebase.

| Layer | Technology | Version / Notes |
|---|---|---|
| Backend runtime | Node.js | 18+ (22+ recommended per README) |
| Backend language | TypeScript | 5.x (tsconfig present in `backend/tsconfig.json`) |
| Backend framework | Express.js | Versioned routing at `/api/v1/*` |
| Query builder | Knex.js | Migrations in `backend/src/database/migrations/` |
| Database | PostgreSQL | 14+, single-schema, UUID PKs |
| Message queue | RabbitMQ | AMQP, topology in `backend/src/integrations/qloapps/queue/` |
| Frontend language | React 18 | JSX (no TypeScript in frontend) |
| Frontend state | Zustand | Per-domain stores in `frontend/src/store/` |
| Frontend routing | React Router v6 | Protected nested routes in `frontend/src/App.jsx` |
| Frontend charting | Recharts | Dashboard KPI charts |
| Build/dev tooling | Vite | Frontend dev server on port 5173 |
| Containerization | Docker Compose | Profiles: `infra`, `workers`, `tools` |
| Infrastructure | Terraform | Single VM cloud target in `infra/` |

**Rationale**: Direct inspection of `backend/tsconfig.json`, `backend/package.json`,
`frontend/src/App.jsx`, root `docker-compose.yml`, and `backend/README.md`.

---

### 2.2 Schema State vs. Documentation

**Decision**: Three schema-state discrepancies exist and must be resolved in Phase 1 (design)
before any Phase 2 schema migrations are created.

| Discrepancy | DATABASE_SCHEMA.md Says | Actual Codebase Shows | Impact |
|---|---|---|---|
| Integration tables | `beds24_sync`, `sync_logs` | QloApps-specific sync tables in migrations | Naming inconsistency in docs; migrations must be ground truth |
| Reservation `source` enum | Includes `Beds24` | May include QloApps or differ | Enum values need audit across schema and code |
| Trigger: auto-generate invoice | PL/pgSQL trigger on `reservations` | Check-in service handles in application code | Risk of double-invoice if both are active |
| Hotel model | Single `hotel_settings` row | `hotels` table and `user_hotels` FK in actual migrations | Multi-tenant overlay exists but docs describe single-hotel only |

**Rationale**: `DATABASE_SCHEMA.md` was written against a Beds24-era design. The actual
migration files and backend services show QloApps integration and multi-tenant support added
later. Phase 1 must produce ERD v2 that reflects actual migration state.

---

### 2.3 Multi-Property Architecture

**Decision**: The system is a multi-property hotel management platform. Each hotel is an
independent tenant in the `hotels` table. Users are assigned to one or more hotels via
`user_hotels`. All operational data (rooms, guests, reservations, invoices, maintenance,
expenses, audit logs) is scoped to a hotel via `hotel_id` FK and enforced per-request by
the `hotelContext` middleware (`X-Hotel-Id` header). `SUPER_ADMIN` users bypass hotel
scoping and can access all properties.

**What was previously described as "single-hotel"**: Earlier documentation (DATABASE_SCHEMA.md,
USE_CASES.md, ERD.md) described this as a single-property design built around a singleton
`hotel_settings` table. That description was inaccurate — the actual migrations show both a
`hotels` table for multi-property tenancy AND a `hotel_settings` table for per-property
configuration (not a singleton). Those docs have been updated.

**Risk**: The backward-compat fallback (`X-Hotel-Id` optional → default hotel) is marked for
removal in `backend/src/services/auth/auth_middleware.ts` (TODO). Until removed, unscoped
requests may silently access the default hotel. This is a security debt item for Phase 4.

**Rationale**: `backend/src/services/auth/auth_middleware.ts`, `backend/src/services/hotels/`,
`backend/src/database/migrations/`

---

## 3. Integration Research

### 3.1 Beds24 vs QloApps: Integration Target Decision

**Decision**: The current implementation targets **QloApps** as the primary channel
integration, not Beds24. `docs/USE_CASES.md` still references Beds24. This is a
documentation drift, not an implementation regression.

**Action required in Phase 0 exit**:
- Update `docs/USE_CASES.md` UC-1001 through UC-1008 to reference QloApps instead of Beds24
  (or document both explicitly if Beds24 is still a future integration target).
- Update `docs/DATABASE_SCHEMA.md` sync table names to reflect QloApps.

**Rationale**: Codebase has extensive `backend/src/integrations/qloapps/` implementation.
`beds24_sync` table name is in DATABASE_SCHEMA.md doc only. `reservations.source` includes
`Beds24` enum value which may also need updating.

---

### 3.2 Channel Sync Architecture

**Decision**: QloApps integration uses a RabbitMQ-backed async queue with inbound, outbound,
and scheduler workers. The sync architecture is structurally sound but has incomplete
outbound sync paths (availability push, rate push are placeholders).

**Alternatives considered**: Direct synchronous API calls to QloApps — rejected because the
current architecture already uses async workers and queue-based reliability; changing this
is out of Phase 0-2 scope.

**Known incomplete areas** (Phase 3 scope):
- `backend/src/integrations/qloapps/services/availability_sync_service.ts` — placeholder
- `backend/src/integrations/qloapps/services/rate_sync_service.ts` — placeholder
- Conflict resolution `applyDirection` logic — TODO in `qloapps_controller.ts`
- Queue depth health metric — TODO in `qloapps_controller.ts`

---

## 4. Security Research

### 4.1 Security Baseline Findings

**Decision**: The following security controls are present and appear functional:

| Control | Status | Evidence |
|---|---|---|
| Password hashing (bcrypt) | Implemented | `backend/src/services/auth/auth_utils.ts` |
| JWT access + refresh token | Implemented | `backend/src/services/auth/auth_controller.ts` |
| RBAC via `requireRole()` | Implemented | `backend/src/services/auth/auth_middleware.ts` |
| Hotel tenant scoping | Implemented (with debt) | `hotelContext` middleware |
| QloApps API key encryption | Implemented | `qloapps_repository.ts` encrypt/decrypt |
| Audit logging | Implemented | `backend/src/services/audit/audit_utils.ts` |

**Known gaps for Phase 4 hardening** (in priority order):

| Gap | Risk Level | Root Cause |
|---|---|---|
| `users_routes` missing `authenticateToken` before `requireRole` | High | `requireRole` expects `req.user` populated by `authenticateToken`; if absent, RBAC silently fails |
| Default JWT secret fallback in `auth_utils.ts` | High | If `JWT_SECRET` env var is missing, a hardcoded default may be used in development |
| Permissive CORS (`*` origin) in `app.ts` | Medium | No origin allowlist; acceptable in dev, not in production |
| No `helmet` / rate-limiting middleware in `app.ts` | Medium | Missing HTTP security headers and request rate guards |
| `hotelContext` fallback to default hotel | Medium | Allows unscoped requests to silently access default hotel |
| Audit reads not filtered by `hotel_id` | Low-Medium | `audit_controller.ts` reads globally despite hotel-scoped routes |
| Debug endpoint in `hotels_routes.ts` exposes broad data | Low | Should be removed before production |

**Rationale**: Code inspection of `backend/src/app.ts`, `backend/src/services/auth/*`,
`backend/src/services/users/users_routes.ts`, `backend/src/services/audit/audit_controller.ts`.

---

## 5. Non-Functional Requirements Research

### 5.1 Performance Targets (from USE_CASES.md)

**Decision**: Accepted as-is from requirements. No contradicting evidence in current code.

| Requirement | Target | Status |
|---|---|---|
| Dashboard load | ≤ 2 seconds | Not measured; Recharts + parallel API calls suggest achievable |
| Search operations | ≤ 1 second | Database indexes on searchable columns exist |
| API responses | ≤ 500ms p95 | Standard Express+Knex+Postgres stack; no profiling done |
| Concurrent users | 100+ | Stateless API + connection pooling; no load test done |

**Phase 7 action**: All NFR targets require load testing and profiling before go-live.

### 5.2 Compliance and Retention

**Decision**: Requirements call for 7-year audit trail retention and GDPR compliance. No
retention policy enforcement or data-deletion/export flows were found in the codebase.

**Phase 4 action**: Implement audit retention policy, guest data export/deletion flows,
and data-at-rest encryption verification.

---

## 6. Terminology and Domain Glossary

**Decision**: The following core terms are canonical for this project:

| Term | Definition |
|---|---|
| Property / Hotel | A single independently operated hotel property. The platform manages multiple such properties under one system. |
| Reservation | A confirmed booking of a room for a date range, linked to a primary guest |
| Check-in | The act of a guest arriving and being assigned their reserved (or walk-in) room |
| Check-out | The act of a guest departing; triggers room-cleaning and invoice generation |
| Room Change | Moving a checked-in guest from one room to another during their stay |
| Invoice | A billing document linked to a reservation and guest; status: Pending/Paid/Cancelled/Overdue |
| Payment | An individual transaction against an invoice (separate `payments` table) |
| Housekeeping | The workflow of tracking and managing room cleaning status (Clean/Dirty/In Progress) |
| Maintenance Request | A logged repair or issue ticket for a room, with priority and status lifecycle |
| Audit Log | An immutable record of every create/update/delete/action performed by a user |
| Channel Manager | An external system (QloApps) that synchronizes rooms, availability, rates, and bookings with OTAs |
| Sync | The process of propagating PMS changes to QloApps (outbound) or receiving updates from QloApps (inbound) |
| Hotel Context | The per-request multi-tenant scope determined by `X-Hotel-Id` header and user-hotel membership |

**Rationale**: Derived from `docs/USE_CASES.md` glossary, `docs/DATABASE_SCHEMA.md` data
dictionary, and codebase naming conventions.
