# API Contract: Reservation ↔ Check-in ↔ Check-out ↔ Invoice

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-04-15  
**Base URL**: `/api/v1` (with `Authorization: Bearer`, `X-Hotel-Id` unless SUPER_ADMIN patterns apply)

## Reservations

| Method | Path | Roles (typical) | Spec / notes |
|--------|------|-----------------|--------------|
| GET | `/reservations` | Per USE_CASES | List/filter; include new statuses when added |
| GET | `/reservations/:id` | Per USE_CASES | Detail for check-in/out decisions |
| POST | `/reservations` | Admin, Manager, Front Desk | UC-301 |
| PATCH | `/reservations/:id` | Admin, Manager, Front Desk | UC-303; **avoid** status check-in/out here (legacy) |
| PATCH | `/reservations/:id` | — | Set **Cancelled**; **No-show** once supported |

**Request bodies (planned deltas)**

- `PATCH /reservations/:id` — `status: "No-show"` | `"Cancelled"` with same validation rules as spec (from Confirmed only, release inventory).

## Check-ins (canonical lifecycle)

| Method | Path | Roles | Behavior |
|--------|------|-------|----------|
| POST | `/reservations/:id/check-in` | ADMIN, SUPER_ADMIN, MANAGER, FRONT_DESK | Body: `actual_room_id`, optional `check_in_time`, `notes`. Validates Confirmed, dates per spec, room free. |
| PATCH | `/check-ins/:id/checkout` | Same | **Planned**: optional body `amount` (invoice total), `notes`, `actual_checkout_time`. Creates **invoice** defaulting to calculated total; completes check-out even if invoice insert fails (spec). |
| POST | `/check-ins/:id/change-room` | Same | Body: `new_room_id`, `change_reason`, `notes`. **Planned**: overlap validation on new room for stay remainder. |
| GET | `/reservations/:id/eligible-rooms` | Authenticated | Rooms eligible for check-in / move |

## Invoices

| Method | Path | Roles | Behavior |
|--------|------|-------|----------|
| GET | `/invoices` | Per USE_CASES | Filter by reservation |
| POST | `/invoices` | Admin, Manager | UC-401; body includes `amount` (optional override of default from reservation) |
| PATCH | `/invoices/:id` | Admin, Manager | UC-403; status / fields |

**Planned checkout-linked behavior**

- `PATCH .../checkout` returns check-in details **and** created `invoice` id/amount in response (or dedicated field), so UI can show “invoice details” per UC-306.

## Error semantics

- **409** — Business rule: wrong status, room occupied, already checked in, invalid transition
- **400** — Validation: dates in future, missing `amount` confirmation for zero if policy requires
- **404** — Unknown reservation / check-in / room

## Non-functional

- QloApps queue calls remain **non-blocking** after successful DB commit (existing pattern).
