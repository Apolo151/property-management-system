# Data model: Backend and documentation alignment

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15  
**Revision**: Server notifications; guest merge; optional reset tokens; docs-as-normative (see [research.md](./research.md) R0).

## New / changed persistence

### `notifications`

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `hotel_id` | UUID FK → hotels | Tenant scope |
| `user_id` | UUID FK → users | Recipient |
| `type` | string or enum | e.g. `CHECK_IN_REMINDER`, `CHECK_OUT_REMINDER`, `MAINTENANCE_ALERT`, `HOUSEKEEPING_ALERT` |
| `title` | string | Short label |
| `body` | text nullable | Or use `payload` JSON only |
| `payload` | JSONB nullable | Structured metadata / deep-link |
| `read_at` | timestamptz nullable | UC-1102 |
| `created_at` | timestamptz | |

**Indexes**: `(user_id, hotel_id, read_at)`, `(hotel_id, created_at DESC)` for housekeeping/admin queries if needed.

**Rules**: Inserts MUST be **hotel-scoped**; recipients MUST be users with a legitimate relationship to the event (assigned staff, role-based broadcast rules per USE_CASES—refine in implementation tasks).

### `password_reset_tokens` (if UC-004 shipped)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `token_hash` | string | Store hash only |
| `expires_at` | timestamptz | Short TTL |
| `used_at` | timestamptz nullable | One-time use |

## Existing entities (behavioral changes)

| Entity | Change |
|--------|--------|
| **users** | `password_hash` updated by change-password and reset-complete |
| **audit_logs** | Additional action types: password change, merge, notification emission (optional) |
| **guests** | Merge: **source** guest deactivated or deleted per policy; FKs repointed to **target** |

## Guest merge (UC-106)

- **Input**: authenticated Admin/Manager; **source** guest id, **target** guest id; same `hotel_id`.
- **Transaction**: Reassign reservations, invoices, and other guest FKs (inventory in implementation); prevent merge if conflicting business rules (e.g. open stays)—define in tasks.
- **Output**: single surviving guest record; audit entry with both ids.

## Validation (change-password / reset)

- Change-password: current password verify; new password policy aligned with register.
- Reset: token single-use; constant-time compare on hash; rate-limit request endpoint (middleware or store).

## Checkout vs invoice

- If USE_CASES expects **stronger** atomicity than today, **prefer code change** to match doc (R0/R9)—details in check-in service tasks.
