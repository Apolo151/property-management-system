# Contract: Notifications API (server-persisted)

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-04-15  
**Base**: `specs/001-phase0-baseline-spec/contracts/core-api.md` — merge when shipping.

## Principles

- Notifications are **durable rows** in PostgreSQL; the API is the **source of truth** for inbox and read state (FR-005).
- All routes: **`Authorization: Bearer`** + **`X-Hotel-Id`** (same rules as other property-scoped modules).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/notifications` | List notifications for **current user** in active hotel; query `unread_only`, `limit`, `cursor`/`offset` |
| PATCH | `/api/v1/notifications/:id/read` | Mark one read |
| POST | `/api/v1/notifications/read-all` | Optional; mark all read for user+hotel |

## Response shape (illustrative)

List item: `id`, `type`, `title`, `body`, `read_at`, `created_at`, `payload` (optional).

## RBAC

- **GET / PATCH / POST** above: any authenticated role that may receive operational notifications per USE_CASES (typically **all** logged-in roles for **their** rows only—enforce `user_id = req.user.id`).

## Emission (non-HTTP contract)

Document in **ARCHITECTURE.md**: which domain events enqueue or insert notifications (check-in/out reminders, maintenance, housekeeping). Emitters MUST NOT duplicate unread rows for the same logical alert (use idempotency key in `payload` or dedupe table if needed).

## Traceability

| Spec | This contract |
|------|----------------|
| FR-005 | Full document |
| SC-005 | Qualitative sign-off with live notifications |
