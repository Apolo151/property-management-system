# Quickstart: Verify backend and documentation alignment

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15  
**Revision**: Server notifications; docs-as-normative intent.

Prerequisites: migrations applied, seeded users per hotel, JWT + `X-Hotel-Id` as required.

## 1. Documentation link sweep (SC-003)

1. `docs/DOCUMENTATION_INDEX.md` — all links resolve.
2. `docs/USE_CASES.md` appendix — **database** link → `backend/docs/DATABASE.md` (or canonical path).
3. Gap report + ARCHITECTURE — **notifications** described as **server-persisted**; QloApps table consistent.

## 2. Role matrix (SC-002)

| Action | Expected |
|--------|----------|
| VIEWER `GET /api/v1/audit-logs` | **200** |
| FRONT_DESK `POST /api/v1/expenses` | **403** |
| MANAGER `POST /api/v1/expenses` | **201** |

## 3. Notifications (FR-005)

1. Trigger an event (e.g. create maintenance request assigned to a user, or perform check-in that should notify housekeeping per rules).
2. As that user, `GET /api/v1/notifications` with hotel header → row appears.
3. `PATCH /api/v1/notifications/:id/read` → `read_at` set; list unread filter excludes it.

## 4. Auth (FR-002)

1. Change password: success with valid current password; old password fails login.
2. Reset password (if enabled): request → token path → confirm → login with new password.

## 5. Guest merge (FR-007)

1. As Admin/Manager, merge duplicate guest A into B within same hotel.
2. Verify reservations/invoices point to B; audit entry exists.

## 6. Exports / PDF (FR-006)

1. Download or export audit/report per implemented endpoint.
2. Download invoice PDF (or agreed format) for UC-407.

## 7. CORS (FR-010)

Production-like env: no wildcard origin for operational API unless explicitly documented exception.

## 8. Tests

```bash
cd backend && npm test
```

Cover notifications CRUD/read rules, merge transaction, RBAC regressions, auth flows.
