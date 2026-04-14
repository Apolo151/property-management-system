# Contract delta: Property context and tenancy

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-04-15  
**Base**: `specs/001-phase0-baseline-spec/contracts/core-api.md` — this file **extends/clarifies**; implementers should merge these rules into `core-api.md` when shipping.

## Headers

| Header | Required on | Semantics |
|--------|-------------|-----------|
| `Authorization: Bearer <token>` | All authenticated routes | Standard JWT. |
| `X-Hotel-Id: <uuid>` | All **property-scoped** operational routes (see below) | Active property; must be a hotel the user may access (or SUPER_ADMIN). |

## Property-scoped route groups (normative)

These MUST enforce `X-Hotel-Id` in **production** (400 + `PROPERTY_CONTEXT_REQUIRED` if missing/invalid after validation rules):

- Rooms, room types, reservations, check-ins, guests, invoices, expenses, maintenance, reports, audit (as mounted today under shared `hotelContext` patterns).
- Settings and QloApps routes that already use `hotelContext`.

## Global or header-optional routes (normative)

- **`/api/auth/*`**: No hotel header.
- **`/api/v1/hotels`** (list/create/manage properties): No `hotelContext` on list; individual hotel operations follow existing handlers.
- **User administration** (`/api/v1/users`): **Always** authenticated; `hotelContext` per [research.md](../research.md) R3 (apply when listing/scoping by property).

## Error contract (reliability)

| HTTP | `code` (body) | When |
|------|----------------|------|
| 400 | `PROPERTY_CONTEXT_REQUIRED` | Valid auth but missing `X-Hotel-Id` where required (production). |
| 400 | `INVALID_HOTEL_ID` | Malformed UUID (optional distinct code). |
| 403 | `HOTEL_ACCESS_DENIED` | User not assigned to hotel (non–SUPER_ADMIN). |
| 404 | `HOTEL_NOT_FOUND` | Unknown or soft-deleted hotel. |
| 401 | `TOKEN_EXPIRED` / `TOKEN_INVALID` | Unauthenticated or bad token (before role checks). |

## Maintenance API

- **List / get / update**: Results MUST be limited to `maintenance_requests.hotel_id === X-Hotel-Id`.
- **Create**: `hotel_id` on created row MUST equal `rooms.hotel_id` for `room_id`; reject if room in another hotel.

## Audit API

- **List / get by id**: Rows MUST match `audit_logs.hotel_id === X-Hotel-Id` for property-scoped access.
- **SUPER_ADMIN**: Same scoping per [research.md](../research.md) R2 unless a future global endpoint is added and documented.

## Users API

- Middleware order: **`authenticateToken` → `requireRole` → (`hotelContext` if applicable)**.
- **ADMIN** assigning users: payload `hotel_ids` ⊆ hotels the admin is assigned to.
- **SUPER_ADMIN**: may assign any valid hotel ids.

## Client (frontend) expectations (UX)

- Clients SHOULD NOT call property-scoped endpoints until `X-Hotel-Id` is set to a property the user selected or the only property they have.
- Clients SHOULD map `PROPERTY_CONTEXT_REQUIRED` to a **property selection** flow, not a generic “error” toast only.
