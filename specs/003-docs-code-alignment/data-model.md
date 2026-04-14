# Data model notes: Multi-property alignment

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

This feature does **not** introduce new tables. It **aligns behavior and docs** with the existing model.

## Entities (logical)

| Entity | Role in this feature |
|--------|----------------------|
| **Hotel (property)** | Tenant root; `id` is sent as `X-Hotel-Id`. |
| **User** | Authenticated principal; `role` drives global vs limited admin powers. |
| **user_hotels** | Assigns users to properties; constrains which hotels an ADMIN may grant. |
| **Room** | Belongs to one `hotel_id`; maintenance create/update must validate room ∈ current hotel. |
| **maintenance_requests** | Must have `hotel_id` consistent with room’s hotel; all reads filtered by `req.hotelId`. |
| **audit_logs** | Must filter by `hotel_id` for list/single fetch in property-scoped mode. |

## Validation rules (enforced in application layer)

1. **Property context**: For routes under `hotelContext`, `hotelId` MUST be resolved from header (production) and MUST match an existing, non-deleted hotel.
2. **Maintenance**: `room_id` MUST reference a room with `room.hotel_id === req.hotelId`.
3. **Audit read**: `audit_logs.hotel_id === req.hotelId` for scoped queries; by-id access MUST 404 or 403 if row’s `hotel_id` differs.
4. **User hotel assignment**: For ADMIN, every `hotel_id` in assign payload MUST appear in `user_hotels` for the acting admin’s user id.

## State transitions

Not applicable (no new lifecycle states).

## Migration impact

None expected. If any insert path omitted `hotel_id` and relied on implicit behavior, fix application inserts to set `hotel_id` explicitly—no schema migration required if column already NOT NULL.
