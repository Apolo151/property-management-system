# Implementation Plan: Phase 0 PMS Baseline

**Branch**: `001-phase0-baseline-spec` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-phase0-baseline-spec/spec.md`

## Summary

Phase 0 establishes the validated business domain baseline for the Hotel PMS. The primary
deliverables are analysis artifacts: a current-capability baseline, a prioritized feature
gap matrix, and a security and integration risk register. All Phase 0 work is documentation
and analysis only — no schema, API, or UI changes are made. Findings from Phase 0 feed
directly into Phase 1 high-level design decisions (ERD v2, UI page map, API endpoint map).

## Technical Context

**Language/Version**: Node.js 18+ / TypeScript 5.x (backend); React 18 JSX (frontend)
**Primary Dependencies**: Express.js, Knex.js, Zustand, React Router v6, Recharts, RabbitMQ (async workers)
**Storage**: PostgreSQL 14+ (Knex migrations and seeds)
**Testing**: Jest (backend; check-in service has baseline tests); no frontend test suite found
**Target Platform**: Linux server via Docker Compose; browser (Vite dev server on port 5173)
**Project Type**: Web application — monorepo (backend API + background workers + frontend SPA)
**Performance Goals**: Dashboard ≤ 2s load; API responses ≤ 500ms p95; Search operations ≤ 1s
**Constraints**: Multi-property hotel management; each property can have multiple room types and rooms; 100+ concurrent users; 7 RBAC roles; users assignable across multiple hotels
**Scale/Scope**: Multiple hotel properties; per-property room inventory; 7 user roles; 1 external channel integration (QloApps) per hotel

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Architecture preserved: Phase 0 is analysis-only; no stack changes proposed or
      required for baseline documentation.
- [x] Core-first scope: All Phase 0 work targets core PMS capability baseline and gap
      identification; channel-manager work is scoped to risk and dependency visibility only.
- [x] Security gate planned: Security and compliance risks are explicitly enumerated in
      `research.md` and the gap matrix (`docs/specs/00-gap-analysis.md`); hardening gates are
      planned for Phase 4.
- [x] Traceability guaranteed: All findings trace to `USE_CASES.md` use-case IDs, codebase
      paths, and gap matrix entries in `docs/specs/00-gap-analysis.md`.
- [x] Incremental verification: Each phase in `IMPLEMENTATION_PHASE_PLAN.md` has documented
      exit criteria; Phase 0 exit requires gap matrix completion and terminology validation.

*Post-Phase 1 re-check: N/A — Phase 0 produces no design artifacts requiring gate re-evaluation.*

## Project Structure

### Documentation (this feature)

```text
specs/001-phase0-baseline-spec/
├── plan.md              # This file
├── research.md          # Phase 0 output: domain and tech research decisions
├── data-model.md        # Phase 1 output: canonical entity model as-built with drift notes
├── quickstart.md        # Phase 1 output: developer verification steps
├── contracts/
│   ├── core-api.md      # Core PMS API surface
│   └── integration-api.md  # Channel integration API surface
└── tasks.md             # Phase 2 output (via /speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/              # Database and RabbitMQ configuration
│   ├── database/
│   │   ├── migrations/      # Knex schema migrations
│   │   └── seeds/           # Seed data
│   ├── integrations/
│   │   └── qloapps/         # QloApps client, workers, queue topology, sync hooks
│   ├── middleware/          # Auth middleware, error handling
│   └── services/            # Domain services:
│       ├── auth/            #   Authentication and RBAC
│       ├── guests/          #   Guest CRUD and sync hooks
│       ├── rooms/           #   Rooms and housekeeping
│       ├── room_types/      #   Room types and availability
│       ├── reservations/    #   Reservation lifecycle
│       ├── check_ins/       #   Check-in/out and room-change
│       ├── invoices/        #   Invoice and payment states
│       ├── expenses/        #   Expense tracking
│       ├── maintenance/     #   Maintenance requests
│       ├── reports/         #   Reporting and analytics
│       ├── audit/           #   Audit log read/write
│       ├── settings/        #   Hotel settings and channel config
│       ├── hotels/          #   Multi-tenant hotel management
│       ├── users/           #   User management (auth wiring debt noted)
│       └── qloapps/         #   QloApps integration API surface

frontend/
├── src/
│   ├── components/          # Shared UI: Notifications, BookingTimeline, Modals
│   ├── pages/               # Route pages per domain
│   └── store/               # Zustand stores per domain

docs/
├── USE_CASES.md             # Source-of-truth use cases (Beds24 vs QloApps drift noted)
├── DATABASE_SCHEMA.md       # Documented schema (multi-property; Beds24-named integration tables need updating)
├── ERD.md                   # ERD diagram
├── ARCHITECTURE.md          # System architecture
└── specs/
    └── 00-gap-analysis.md   # Phase 0 gap matrix output
```

**Structure Decision**: Option 2 — Web application. Repository has `backend/` + `frontend/`
monorepo with a dedicated `docs/` folder. No mobile layer is present or planned for Phase 0.
