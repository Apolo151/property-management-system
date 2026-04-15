# Implementation Plan: Backend and documentation alignment

**Branch**: `005-backend-spec-alignment` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-backend-spec-alignment/spec.md`

## Summary

Align **implementation to canonical documentation** (`docs/USE_CASES.md` and linked core docs): **`docs` state normative product intent**—when behavior differs, **correct code** (and API contracts) first; amend docs only for **explicit** same-release product decisions. Deliver **server-persisted notifications** (list, read state, emission from operational events), plus RBAC/auth/CORS parity, **guest merge (UC-106)**, **password reset + change password** where the use cases apply, and **export/PDF** capabilities where the use cases still promise them—using **lean** designs (single notifications module, minimal PDF/export stack).

**Delivery order**: Locked decisions ([research.md](./research.md) **R0–R9**) → **schema migrations** (notifications; optional password-reset tokens) → **notifications service + hooks** → **auth + guests merge + exports/PDF** → **RBAC/CORS** → **documentation and gap report** (honest UI vs API classification, link fixes) → **contract merge** → [quickstart.md](./quickstart.md) verification.

## Technical Context

**Language/Version**: Node.js 18+, TypeScript 5.x (backend)  
**Primary Dependencies**: Express, Knex, PostgreSQL, JWT; minimal PDF/export library TBD in implementation (choose one small dependency)  
**Storage**: PostgreSQL — **new** `notifications` table; likely **`password_reset_tokens`** (or equivalent) for UC-004; no Redis required for v1  
**Testing**: Backend `npm test`; add integration tests for notifications, merge, RBAC, auth flows  
**Target Platform**: Linux / Docker Compose per repo  
**Project Type**: Web application (backend API + SPA; frontend must consume notification API for inbox)  
**Performance Goals**: Notification list paginated; exports streamed or capped to reasonable row counts  
**Constraints**: Feature-based `backend/src/services/*` layout; reuse `hotelContext` and existing audit helpers  
**Scale/Scope**: Auth, audit, expenses, guests (merge), check-ins (hooks), maintenance/housekeeping (hooks), invoices (PDF), reports/audit (export), `app.ts` CORS, `docs/*` sync

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Architecture preserved**: Adds **one** vertical feature module (`notifications`) and migrations—consistent with existing Express + Knex services.
- [x] **Core-first scope**: Notifications, RBAC, auth, guest merge, and billing artifacts are **core PMS**; QloApps work remains classification/docs unless code change is required for honesty.
- [x] **Security gate planned**: RBAC on notification and merge endpoints, reset-token secrecy, CORS production allowlist, audit on merge and password changes.
- [x] **Traceability guaranteed**: FR-001–FR-010 map to [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).
- [x] **Incremental verification**: Migrations → unit/integration → manual quickstart → stakeholder sign-off (SC-005).

### Post–Phase 1 re-check

Design introduces **persisted notifications** and **possible reset-token storage**—still within constitution; no alternate stack. [Complexity Tracking](#complexity-tracking) records the single justified expansion.

## Project Structure

### Documentation (this feature)

```text
specs/005-backend-spec-alignment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── doc-and-rbac-alignment.md
│   └── notifications-api.md
└── tasks.md             # /speckit.tasks
```

### Source code (repository root)

```text
docs/USE_CASES.md, docs/PMS_USE_CASE_QLOAPPS_GAP_REPORT.md, docs/ARCHITECTURE.md,
docs/DOCUMENTATION_INDEX.md, docs/CHECK_INS_API_DOCUMENTATION.md

backend/src/database/migrations/          # notifications, optional reset tokens
backend/src/services/notifications/     # new: routes, controller, service
backend/src/services/auth/
backend/src/services/guests/
backend/src/services/invoices/          # PDF download
backend/src/services/reports/           # export endpoints
backend/src/services/audit/             # export + RBAC
backend/src/services/check_ins/         # notification hooks
backend/src/services/maintenance/
backend/src/services/rooms/
backend/src/app.ts
backend/docs/DATABASE.md
specs/001-phase0-baseline-spec/contracts/core-api.md
```

**Structure decision**: New code under **`backend/src/services/notifications/`** plus targeted edits in domain services for **emitters** and **exports**.

## Execution phases

### Wave A — Schema

1. Migration: **`notifications`** per [data-model.md](./data-model.md).
2. Migration: **`password_reset_tokens`** (user id, token hash, expires_at) if implementing UC-004 in this milestone.

### Wave B — Notifications (FR-005)

1. Implement **notifications** module: list (paginated), **mark read**, optional **mark all read**.
2. Wire **emitters** from check-in/out flows, maintenance create/update, housekeeping status changes—**idempotent** where repeated calls could occur.
3. Update **gap report** and **ARCHITECTURE** to state notifications are **API-backed persisted**; frontend tasks consume this API (may be separate PR).

### Wave C — Auth (FR-002)

1. **Change password** (authenticated).
2. **Reset password**: request + confirm using **stored token**; **email** via pluggable notifier (log in dev, SMTP when configured)—behavior must match USE_CASES intent.

### Wave D — Guests merge (FR-007)

1. **POST** merge endpoint: transactional reassignment + audit; RBAC Admin/Manager per USE_CASES.

### Wave E — Exports and PDF (FR-006)

1. **Audit** and **reports** export (CSV or agreed format).
2. **Invoice PDF** download for UC-407—minimal template.

### Wave F — RBAC, CORS, docs hygiene

1. **VIEWER** on audit reads; **FRONT_DESK** off expense mutating routes.
2. **CORS** production allowlist ([research.md](./research.md) R4).
3. **USE_CASES** appendix links, **DATABASE** path, **CHECK_INS** narrative, **QloApps** classification table (FR-004, FR-008).

### Wave G — Contracts and verification

1. Merge [contracts/doc-and-rbac-alignment.md](./contracts/doc-and-rbac-alignment.md) and [contracts/notifications-api.md](./contracts/notifications-api.md) into `core-api.md` (or cross-link normatively).
2. Run [quickstart.md](./quickstart.md).

## Complexity Tracking

| Expansion | Why needed | Simpler alternative rejected because |
|-----------|------------|-------------------------------------|
| New **`notifications`** service + table | **FR-005** and explicit stakeholder requirement for server-side notifications | Client-only lists cannot satisfy durable read/mark-read semantics |

## Phase outputs (Speckit)

| Phase | Artifact | Status |
|-------|----------|--------|
| 0 | [research.md](./research.md) | Revised 2026-04-15 |
| 1 | [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md) | Updated with notifications + R0 |
| 2 | `tasks.md` via `/speckit.tasks` | Not created here |
