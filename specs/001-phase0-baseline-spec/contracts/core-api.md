# Core PMS API Contract Surface

**Feature**: Phase 0 PMS Baseline  
**Date**: 2026-04-14  
**Base URL**: `/api/v1`  
**Auth**: All endpoints require `Authorization: Bearer <access_token>` unless noted.  
**Hotel Scope**: All operational endpoints require `X-Hotel-Id: <hotel_uuid>` header. Each
hotel is an independent property tenant. `SUPER_ADMIN` users can access any hotel.
Users must be assigned to a hotel via `user_hotels` to access its data.

This document describes the existing API surface as-built, including current coverage
status and known gaps.

---

## 0. Hotels (`/api/v1/hotels`)

Multi-property management. Only `SUPER_ADMIN` and `ADMIN` can create or manage hotels.
`SUPER_ADMIN` users bypass the `X-Hotel-Id` scope restriction for this module.

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/hotels` | List all hotels accessible to the user | ✅ Implemented | SUPER_ADMIN sees all |
| POST | `/api/v1/hotels` | Create a new hotel property | ✅ Implemented | SUPER_ADMIN only |
| GET | `/api/v1/hotels/:id` | Get hotel details | ✅ Implemented | — |
| PUT | `/api/v1/hotels/:id` | Update hotel details | ✅ Implemented | — |
| DELETE | `/api/v1/hotels/:id` | Soft-delete hotel | ✅ Implemented | — |
| POST | `/api/v1/hotels/:id/assign-user` | Assign a user to a hotel | ✅ Implemented | UC-006 |
| DELETE | `/api/v1/hotels/:id/users/:userId` | Remove user from hotel | ✅ Implemented | — |

---

## 1. Authentication (`/api/auth`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | Authenticate user, return JWT pair | ✅ Implemented | UC-001 |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token | ✅ Implemented | UC-003 |
| POST | `/api/auth/logout` | Invalidate refresh token | ✅ Implemented | UC-002 |
| GET | `/api/auth/me` | Get current user profile | ✅ Implemented | — |
| POST | `/api/auth/register` | Create new user (admin only) | ✅ Implemented | — |
| POST | `/api/auth/reset-password` | Request password reset token | ❌ Missing | UC-004 |
| POST | `/api/auth/reset-password/confirm` | Complete reset with token | ❌ Missing | UC-004 |
| PUT | `/api/auth/change-password` | Change own password (authenticated) | ⚠️ Partial | UC-005 |

**Request (login)**:
```json
{ "email": "string", "password": "string" }
```

**Response (login)**:
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user": { "id": "uuid", "email": "string", "role": "string", "first_name": "string", "last_name": "string" }
}
```

---

## 2. Users (`/api/v1/users`)

⚠️ **Security debt**: `requireRole` is applied but `authenticateToken` middleware wiring
needs verification. Treat all these endpoints as requiring both middleware.

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/users` | List users (hotel-scoped) | ⚠️ Partial | Auth wiring gap |
| POST | `/api/v1/users` | Create user + assign to hotel | ⚠️ Partial | UC-006 |
| GET | `/api/v1/users/:id` | Get user by ID | ⚠️ Partial | — |
| PUT | `/api/v1/users/:id` | Update user info / role | ⚠️ Partial | UC-006 |
| DELETE | `/api/v1/users/:id` | Soft-delete user | ⚠️ Partial | — |

---

## 3. Guests (`/api/v1/guests`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/guests` | List guests (search, paginated) | ✅ Implemented | UC-104 |
| POST | `/api/v1/guests` | Create guest | ✅ Implemented | UC-101 |
| GET | `/api/v1/guests/:id` | Get guest profile | ✅ Implemented | UC-102 |
| PUT | `/api/v1/guests/:id` | Update guest info | ✅ Implemented | UC-103 |
| DELETE | `/api/v1/guests/:id` | Soft-delete guest | ✅ Implemented | — |
| GET | `/api/v1/guests/:id/history` | Guest stay history | ✅ Implemented | UC-105 |
| POST | `/api/v1/guests/:id/notes` | Add note to guest | ✅ Implemented | UC-107 |
| POST | `/api/v1/guests/merge` | Merge two guest records | ❌ Missing | UC-106 |

---

## 4. Room Types (`/api/v1/room-types`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/room-types` | List room types | ✅ Implemented | — |
| POST | `/api/v1/room-types` | Create room type | ✅ Implemented | — |
| GET | `/api/v1/room-types/:id` | Get room type | ✅ Implemented | — |
| PUT | `/api/v1/room-types/:id` | Update room type | ✅ Implemented | — |
| DELETE | `/api/v1/room-types/:id` | Delete room type | ✅ Implemented | — |
| GET | `/api/v1/room-types/availability` | Check availability for dates | ✅ Implemented | UC-310 |

---

## 5. Rooms (`/api/v1/rooms`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/rooms` | List rooms with filters | ✅ Implemented | UC-202, UC-205 |
| POST | `/api/v1/rooms` | Create room | ✅ Implemented | UC-201 |
| GET | `/api/v1/rooms/:id` | Get room details | ✅ Implemented | UC-202 |
| PUT | `/api/v1/rooms/:id` | Update room info/status | ✅ Implemented | UC-203, UC-204 |
| DELETE | `/api/v1/rooms/:id` | Delete room | ✅ Implemented | — |
| GET | `/api/v1/rooms/availability` | Room availability calendar | ✅ Implemented | UC-206 |
| PUT | `/api/v1/rooms/:id/status` | Update room status directly | ✅ Implemented | UC-204, UC-209 |
| GET | `/api/v1/rooms/housekeeping` | Housekeeping status list | ✅ Implemented | UC-501 |
| PUT | `/api/v1/rooms/:id/housekeeping` | Update housekeeping status | ✅ Implemented | UC-502, UC-504, UC-505 |
| PUT | `/api/v1/rooms/:id/housekeeping/assign` | Assign staff to room | ✅ Implemented | UC-503 |

**Room status enum**: `Available` \| `Occupied` \| `Cleaning` \| `Out of Service`  
**Housekeeping status enum**: `Clean` \| `Dirty` \| `In Progress`

---

## 6. Reservations (`/api/v1/reservations`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/reservations` | List/search reservations | ✅ Implemented | UC-302, UC-307 |
| POST | `/api/v1/reservations` | Create reservation | ✅ Implemented | UC-301 |
| GET | `/api/v1/reservations/:id` | Get reservation details | ✅ Implemented | UC-302 |
| PUT | `/api/v1/reservations/:id` | Update reservation | ⚠️ Partial | UC-303 — lifecycle consistency gap |
| DELETE | `/api/v1/reservations/:id` | Cancel/soft-delete | ⚠️ Partial | UC-304 — cancellation rules incomplete |
| PUT | `/api/v1/reservations/:id/dates` | Modify reservation dates | ⚠️ Partial | UC-311 |
| POST | `/api/v1/reservations/:id/guests` | Add second guest | ⚠️ Partial | UC-312 |
| GET | `/api/v1/reservations/calendar` | Calendar view data | ✅ Implemented | UC-308 |

**Reservation status enum**: `Confirmed` \| `Checked-in` \| `Checked-out` \| `Cancelled`

**Create reservation request**:
```json
{
  "room_id": "uuid",
  "primary_guest_id": "uuid",
  "check_in": "YYYY-MM-DD",
  "check_out": "YYYY-MM-DD",
  "total_amount": 0.00,
  "source": "Direct",
  "special_requests": "string (optional)"
}
```

---

## 7. Check-ins (`/api/v1/check-ins`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/check-ins` | List active check-ins | ✅ Implemented | — |
| POST | `/api/v1/check-ins` | Check in a reservation | ✅ Implemented | UC-305 |
| GET | `/api/v1/check-ins/:id` | Get check-in record | ✅ Implemented | — |
| POST | `/api/v1/check-ins/:id/checkout` | Check out | ✅ Implemented | UC-306 |
| POST | `/api/v1/check-ins/:id/room-change` | Move guest to different room | ✅ Implemented | — |
| GET | `/api/v1/check-ins/eligible-rooms` | Rooms eligible for check-in | ✅ Implemented | — |

---

## 8. Invoices (`/api/v1/invoices`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/invoices` | List invoices (filtered) | ✅ Implemented | UC-402, UC-408 |
| POST | `/api/v1/invoices` | Create invoice | ✅ Implemented | UC-401 |
| GET | `/api/v1/invoices/:id` | Get invoice | ✅ Implemented | UC-402 |
| PUT | `/api/v1/invoices/:id` | Update invoice | ✅ Implemented | UC-403 |
| POST | `/api/v1/invoices/:id/pay` | Mark invoice paid + record payment method | ✅ Implemented | UC-404, UC-405 |
| POST | `/api/v1/invoices/:id/cancel` | Cancel invoice | ✅ Implemented | UC-406 |
| GET | `/api/v1/invoices/:id/pdf` | Generate invoice PDF | ❌ Missing | UC-407 |

**Invoice status enum**: `Pending` \| `Paid` \| `Cancelled` \| `Overdue`  
**Payment methods**: `Cash` \| `Card` \| `Online` \| `Bank Transfer`

---

## 9. Expenses (`/api/v1/expenses`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/expenses` | List expenses (filter by category/date) | ✅ Implemented | UC-702, UC-707 |
| POST | `/api/v1/expenses` | Create expense | ✅ Implemented | UC-701 |
| GET | `/api/v1/expenses/:id` | Get expense | ✅ Implemented | — |
| PUT | `/api/v1/expenses/:id` | Update expense | ✅ Implemented | UC-703 |
| DELETE | `/api/v1/expenses/:id` | Delete expense | ✅ Implemented | UC-704 |
| GET | `/api/v1/expenses/categories` | Get category totals | ✅ Implemented | UC-705, UC-706 |

---

## 10. Maintenance (`/api/v1/maintenance`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/maintenance` | List requests (filter/search) | ✅ Implemented | UC-602, UC-606 |
| POST | `/api/v1/maintenance` | Create request | ✅ Implemented | UC-601 |
| GET | `/api/v1/maintenance/:id` | Get request | ✅ Implemented | — |
| PUT | `/api/v1/maintenance/:id` | Update status/priority/assignment | ✅ Implemented | UC-603, UC-604 |
| POST | `/api/v1/maintenance/:id/complete` | Mark repaired | ✅ Implemented | UC-605 |

**⚠️ Gap**: Service layer may not filter requests by `hotel_id` — verify in Phase 2.

---

## 11. Reports (`/api/v1/reports`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/reports/stats` | Consolidated stats: occupancy, revenue, reservations | ✅ Implemented | UC-802–UC-805 |
| GET | `/api/v1/reports/export` | Export reservations/guests/invoices/expenses (CSV/JSON) | ✅ Implemented | UC-806 |
| GET | `/api/v1/reports/cancellation-rate` | Cancellation rate metric | ⚠️ Partial | UC-807 |
| GET | `/api/v1/reports/occupancy-forecast` | Occupancy forecast | ⚠️ Partial | UC-808 |

---

## 12. Audit Logs (`/api/v1/audit`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/audit` | List logs (search, filter by entity/action) | ✅ Implemented | UC-901, UC-902, UC-904 |
| GET | `/api/v1/audit/export` | Export audit logs | ⚠️ Partial | UC-903 |

**⚠️ Gap**: Reads are not filtered by `hotel_id` despite hotel-scoped route context (Phase 4).

---

## 13. Notifications (`/api/v1/notifications`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | Get user notifications | ✅ Implemented | UC-1101 |
| PUT | `/api/v1/notifications/:id/read` | Mark notification read | ✅ Implemented | UC-1102 |
| PUT | `/api/v1/notifications/read-all` | Mark all read | ✅ Implemented | — |

**⚠️ Gap**: Automated reminder/alert generation for check-in/out reminders and maintenance
alerts (UC-1103–UC-1106) is not evidenced in the codebase — Phase 2 work.

---

## 14. Settings (`/api/v1/settings`)

| Method | Path | Description | Status | Notes |
|---|---|---|---|---|
| GET | `/api/v1/settings` | Get hotel settings | ✅ Implemented | — |
| PUT | `/api/v1/settings` | Update hotel settings | ✅ Implemented | — |
| GET | `/api/v1/settings/channel-manager` | Get channel manager config status | ✅ Implemented | UC-1008 |
| PUT | `/api/v1/settings/channel-manager` | Configure channel manager | ✅ Implemented | UC-1008 |
| POST | `/api/v1/settings/channel-manager/test` | Test connection | ✅ Implemented | — |

---

## Standard Error Response

```json
{
  "error": "string",
  "message": "string",
  "statusCode": 400
}
```

## Pagination (list endpoints)

```
GET /api/v1/guests?page=1&limit=20&search=John&sort=name&order=asc
```

Response includes:
```json
{
  "data": [],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```
