# Implementation Plan: Documentation-then-product alignment (multi-property)

**Branch**: `003-docs-code-alignment` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-docs-code-alignment/spec.md`  
**Focus**: **UX clarity** (users always know which property they operate in; no silent wrong-hotel work) and **reliability** (predictable errors, enforced boundaries, verifiable tests).

## Summary

Align canonical documentation with the **multi-property tenant** model, then align **backend and frontend** so maintenance, audit, user administration, and property context behave consistently with those docs. Primary outcomes: (1) staff cannot accidentally view or mutate another property’s data through normal flows; (2) missing or invalid property context produces **explicit** feedback instead of silent defaults; (3) docs, API contract, and runtime agree on which routes are property-scoped vs global.

**Delivery order**: **Documentation corrections first** (or same PR as code when tightly coupled), then **middleware + controller fixes**, then **UX flows** (property selection and error surfaces), then **automated verification** (two-property suite).

## Technical Context

**Language/Version**: Node.js 18+, TypeScript 5.x (backend); React 18 (frontend)  
**Primary Dependencies**: Express, Knex, PostgreSQL, JWT auth; React Router, Zustand (as in repo)  
**Storage**: PostgreSQL (existing schema: `hotels`, `hotel_id` on tenant tables, `user_hotels`)  
**Testing**: `npm test` / backend test runner as configured in repo; add or extend integration tests for tenancy  
**Target Platform**: Linux / Docker Compose local and deployment targets per repo  
**Project Type**: Web application (backend API + SPA frontend)  
**Performance Goals**: No new latency requirements; property filters use existing indexed `hotel_id` columns  
**Constraints**: Preserve Express + Knex + middleware patterns; no new infrastructure; production must not rely on implicit default property (see [research.md](./research.md))  
**Scale/Scope**: All authenticated operational modules that already use or should use `hotelContext`; docs under `docs/` and contract under `specs/001-phase0-baseline-spec/contracts/core-api.md` (updated in place or supplemented by feature contract)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Architecture preserved**: Tenant enforcement uses existing `hotelContext`, `AuthenticatedRequest.hotelId`, and `hotel_id` columns—no new stack.
- [x] **Core-first scope**: Work is core PMS + admin; channel manager only where docs must clarify boundaries.
- [x] **Security gate planned**: RBAC ordering (auth before role), tenant isolation tests, audit visibility rules documented and verified before production release of this feature.
- [x] **Traceability guaranteed**: FR-001–FR-007 map to user stories, [data-model.md](./data-model.md), [contracts/property-context-and-tenancy.md](./contracts/property-context-and-tenancy.md), and verification in [quickstart.md](./quickstart.md).
- [x] **Incremental verification**: Doc review checklist → backend contract tests / integration tests → UX smoke on two properties.

### Post–Phase 1 re-check

Design artifacts add **contract deltas** and **UX/error semantics** only; no constitution violations. Complexity table remains empty.

## UX and reliability principles (drives implementation order)

| Principle | UX implication | Reliability implication |
|-----------|----------------|-------------------------|
| **Visible property context** | Header or persistent control shows **current property name** on operational pages; switching property refreshes data. | Reduces operator error; pairs with correct `X-Hotel-Id` on every call. |
| **No silent wrong hotel** | If no property selected when required, show **blocking prompt** or inline error—not an empty list that “looks fine”. | API returns **400** with stable `code` (e.g. `PROPERTY_CONTEXT_REQUIRED`); production forbids default UUID fallback. |
| **Honest errors** | Copy explains *what* to do (“Select a property” / “You don’t have access to this property”). | Same codes documented in contract for clients to handle. |
| **Admin clarity** | User management UI indicates scope (global vs property-limited admin). | Backend rejects out-of-scope `hotel_ids` assignments. |
| **Prove two properties** | Manual QA uses two hotels with distinct maintenance + audit rows. | Automated tests assert no cross-tenant leakage on list and get-by-id. |

## Project Structure

### Documentation (this feature)

```text
specs/003-docs-code-alignment/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── property-context-and-tenancy.md
└── tasks.md             # /speckit.tasks (not created here)
```

### Source code (repository root)

```text
docs/
├── ARCHITECTURE.md
├── DATABASE_SCHEMA.md
└── specs/00-gap-analysis.md          # optional status refresh

specs/001-phase0-baseline-spec/contracts/core-api.md

backend/src/services/auth/auth_middleware.ts
backend/src/services/maintenance/
backend/src/services/audit/
backend/src/services/users/users_routes.ts
backend/src/services/users/users_controller.ts
backend/tests/                        # extend with tenancy integration tests (path as existing convention)

frontend/src/utils/api.js
frontend/src/store/                   # auth / hotel selection (as applicable)
frontend/src/pages/                 # property picker, error surfaces
```

**Structure decision**: Changes stay in existing **backend feature services** and **frontend API wrapper + store/pages**; documentation updates are **canonical** under `docs/` and **contract** under `specs/`.

## Execution phases (clear sequence)

### Wave A — Documentation (enables verification)

1. **`docs/ARCHITECTURE.md`**: New section *Multi-property tenancy*—property context header, middleware order, `user_hotels`, routes that **omit** hotel context (e.g. list hotels, auth), SUPER_ADMIN behavior summary.
2. **`docs/DATABASE_SCHEMA.md`**: Fix contradictory **hotel_settings** excerpt (mark historical or replace with per-`hotel_id` truth); soften “every API request” to **route groups** aligned with reality.
3. **`specs/001-phase0-baseline-spec/contracts/core-api.md`**: Sync with [property-context-and-tenancy.md](./contracts/property-context-and-tenancy.md) (merge or cross-link); remove “needs verification” debt where behavior is fixed.

### Wave B — Backend reliability

1. **`users_routes.ts`**: Apply `authenticateToken` (and `hotelContext` if user-admin is hotel-scoped per policy) **before** `requireRole`.
2. **`users_controller.ts`**: Enforce **assignment scope**—ADMIN may only assign hotels they belong to; SUPER_ADMIN unrestricted (per existing RBAC).
3. **`maintenance_controller.ts`**: All queries and writes filter by `hotel_id` derived from `req.hotelId` and validated room ownership; insert sets `hotel_id` from room row.
4. **`audit_controller.ts`**: List and get-by-id filter `audit_logs.hotel_id` to `req.hotelId`; SUPER_ADMIN follows documented rule (typically same header-scoped filter when header present).
5. **`auth_middleware.ts`**: **Production**: reject missing `X-Hotel-Id` on routes using `hotelContext` with 400 + `PROPERTY_CONTEXT_REQUIRED` (or equivalent). **Development**: optional `ALLOW_DEFAULT_HOTEL` env for legacy local scripts—documented in `backend/README.md` only.

### Wave C — Frontend UX

1. **After login**: If exactly one assigned property → set `activeHotelId` automatically. If multiple → **property picker** before deep navigation (or gated dashboard).
2. **`api.js`**: Ensure operational calls always send `X-Hotel-Id` when a property is selected; surface API error codes with user-visible messages.
3. **Operational pages**: Show **current property** in layout; on `PROPERTY_CONTEXT_REQUIRED`, route to picker or show modal.

### Wave D — Verification evidence

1. Run scenarios in [quickstart.md](./quickstart.md).
2. Add automated tests: maintenance + audit cross-tenant negatives; unauthenticated user routes return 401 before role logic.
3. Update `docs/specs/00-gap-analysis.md` rows for maintenance/audit/users when closed.

## Complexity Tracking

No constitution violations; table not used.

## Phase outputs (Speckit)

| Phase | Artifact | Status |
|-------|----------|--------|
| 0 | [research.md](./research.md) | Complete |
| 1 | [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md) | Complete |
| 2 | `tasks.md` via `/speckit.tasks` | Not created by this command |
