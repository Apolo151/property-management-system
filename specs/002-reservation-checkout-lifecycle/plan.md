# Implementation Plan: Reservation to Check-out Lifecycle

**Branch**: `001-phase0-baseline-spec` (current git) | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)  
**Feature directory**: `specs/002-reservation-checkout-lifecycle`  
**Input**: Feature specification — Phase 2 core PMS lifecycle (reservation → check-in → check-out → invoice), including **Cancelled**, **No-show**, in-stay **room move**, and **custom invoice total** with audit.

## Summary

Close the gap between [spec.md](./spec.md) and the **as-built** backend/frontend: align reservation **status** model (**No-show**), enforce **date guards** for check-in/check-out per use cases, implement **invoice creation** on check-out (with **optional amount override** and **audit** when amount ≠ calculated default), ensure **housekeeping/notifications** match spec, and verify the **Check-ins API** is the canonical path (legacy `PATCH` reservation status remains deprecated). **Room change while checked-in** already exists in `check_ins_service.changeRoom`; validate against spec (e.g. target room availability for remainder of stay) and wire UI if missing.

Work stays inside the existing **Express + Knex + PostgreSQL** backend and **React + Zustand** frontend; channel sync remains non-blocking.

## Technical Context

**Language/Version**: Node.js 18+ / TypeScript 5.x (backend); React 18 JSX (frontend)  
**Primary Dependencies**: Express.js, Knex.js, Zustand, React Router v6, RabbitMQ (optional QloApps hooks)  
**Storage**: PostgreSQL 14+ (Knex migrations)  
**Testing**: Jest (backend); extend check-in / reservation tests where lifecycle changes land  
**Target Platform**: Linux / Docker Compose; browser (Vite dev server)  
**Project Type**: Web monorepo — `backend/` + `frontend/` + `docs/`  
**Performance Goals**: Check-in/check-out API p95 ≤ 500ms under normal load (align with Phase 0 baseline)  
**Constraints**: Multi-property; `X-Hotel-Id` scoping; RBAC per `docs/USE_CASES.md` modules 3–6  
**Scale/Scope**: Five reservation business states; single invoice **amount** per spec (no line items in Phase 2); audit on amount override

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Architecture preserved**: Extend existing `check_ins`, `reservations`, `invoices`, `audit` modules; no new runtime stack.
- [x] **Core-first scope**: No deep channel-manager work; QloApps hooks remain best-effort after commit.
- [x] **Security gate planned**: RBAC on check-in/out/room-change; audit for lifecycle and invoice overrides; production hardening remains Phase 4.
- [x] **Traceability**: Spec FR-001–FR-014 and user stories map to research gaps, data-model deltas, and contract updates in this folder.
- [x] **Incremental verification**: `quickstart.md` lists smoke scenarios; tasks (via `/speckit.tasks`) will add explicit test tasks.

*Post–Phase 1 re-check: design artifacts below are consistent with constitution; schema changes require same-milestone doc updates per Principle IV.*

## Project Structure

### Documentation (this feature)

```text
specs/002-reservation-checkout-lifecycle/
├── plan.md              # This file
├── research.md          # Phase 0: as-built vs spec decisions
├── data-model.md        # Phase 1: lifecycle + schema deltas
├── quickstart.md        # Phase 1: verification steps
├── contracts/
│   └── reservation-lifecycle-api.md
└── tasks.md             # Phase 2 — /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
backend/src/
├── services/
│   ├── check_ins/       # checkInGuest, checkOutGuest, changeRoom, routes
│   ├── reservations/   # CRUD, overlap, legacy status updates (deprecate for check-in/out)
│   ├── invoices/       # create/list/update/mark paid
│   ├── housekeeping/   # room cleaning state
│   ├── notifications/  # if used for housekeeping alerts
│   └── audit/          # audit_utils — extend for invoice amount override
├── database/migrations/
frontend/src/
├── pages/               # Reservations, Check-ins UI
└── store/               # Reservation / check-in state
```

**Structure Decision**: Web application monorepo. Lifecycle implementation is concentrated in **check_ins** + **reservations** + **invoices** + **frontend** reservation/check-out flows.

## Complexity Tracking

No constitution violations. Optional complexity: DB migration to add **No-show** and invoice **calculated_amount** / override audit fields — justified by spec clarifications 2026-04-15.
