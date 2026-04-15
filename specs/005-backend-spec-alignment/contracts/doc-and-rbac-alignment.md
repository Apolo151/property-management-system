# Contract delta: Documentation and RBAC alignment

**Feature**: [spec.md](../spec.md)  
**Date**: 2026-04-15  
**Base**: `specs/001-phase0-baseline-spec/contracts/core-api.md` — merge these deltas when shipping this milestone.

## Purpose

Normative **API and documentation** rules so integrators and operators see the same **role** and **capability** story as `docs/USE_CASES.md` after alignment. **`docs/USE_CASES.md` is normative**—these deltas describe **code changes** to match that intent ([research.md](../research.md) R0).

## Additional contracts

- **[notifications-api.md](./notifications-api.md)** — persisted notifications (FR-005).
- **Guest merge**, **password reset**, **exports/PDF**: specify paths and payloads in `core-api.md` when implementing Waves C–E (merge `POST /api/v1/guests/:id/merge` or equivalent; reset `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`; export `GET ...?format=csv` etc.).

## RBAC deltas (normative)

### Audit logs (`/api/v1/audit-logs`, `/api/v1/audit-logs/:id`)

| Method | Path | Roles allowed (after change) |
|--------|------|------------------------------|
| GET | `/audit-logs` | `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `VIEWER` |
| GET | `/audit-logs/:id` | Same |

All calls remain **`authenticateToken` + `hotelContext`** as today.

### Expenses (`/api/v1/expenses*`)

| Method | Path | Roles allowed (after change) |
|--------|------|------------------------------|
| POST | `/expenses` | `SUPER_ADMIN`, `ADMIN`, `MANAGER` |
| PUT | `/expenses/:id` | `SUPER_ADMIN`, `ADMIN`, `MANAGER` |
| DELETE | `/expenses/:id` | `SUPER_ADMIN`, `ADMIN` (unchanged if already so) |
| GET | `/expenses`, `/expenses/stats`, `/expenses/:id` | Per existing policy (must match USE_CASES read actors after review) |

### Change password (new)

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/api/auth/change-password` | Bearer JWT | `{ "current_password": "...", "new_password": "..." }` |

**Responses**:

- **200**: `{ "message": "Password updated" }` (or consistent success shape with existing auth responses).
- **400**: validation errors.
- **401**: missing/invalid token or wrong current password.

**Note**: **Password reset** (UC-004) MUST be added to `core-api.md` with **token persistence** and **confirm** endpoint when implemented; delivery may use env-configured email or a documented dev stub—**docs remain authoritative** (R0).

## CORS (normative for deployed environments)

| Environment | Behavior |
|-------------|----------|
| Development | Permissive CORS MAY remain for local SPA (document in ARCHITECTURE). |
| Production | `Access-Control-Allow-Origin` MUST NOT be `*` for operational APIs unless explicitly approved; use configured allowlist(s). |

## Documentation cross-references

After merge:

- `docs/USE_CASES.md` appendix → `backend/docs/DATABASE.md` (or repo-relative path that exists).
- `docs/DOCUMENTATION_INDEX.md` lists the same database doc path.
- QloApps: one classification table shared by **USE_CASES**, **gap report**, **ARCHITECTURE** (FR-004).

## Traceability

| Spec FR | Contract section |
|---------|------------------|
| FR-001 | RBAC deltas (audit, expenses) |
| FR-002 | Change password + reset deferral note |
| FR-010 | CORS |
| FR-005 | [notifications-api.md](./notifications-api.md) |
| FR-006, FR-007 | Guest merge + export/PDF paths in core-api (when added) |
| FR-008, FR-009 | Cross-references + core-api sync |
