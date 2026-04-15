---
description: "Task list — Reservation to Check-out Lifecycle (Feature 002)"
---

# Tasks: Reservation to Check-out Lifecycle

**Input**: Design documents from `/specs/002-reservation-checkout-lifecycle/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/reservation-lifecycle-api.md](./contracts/reservation-lifecycle-api.md)

**Tests**: Targeted Jest extension for check-in/out (User Story 1). No full TDD mandate in spec.

**Organization**: Phases follow [spec.md](./spec.md) user stories P1 → P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallel when different files and no ordering dependency within the same phase
- **[Story]**: `[US1]`–`[US4]` for user-story phases only

## Path Conventions

- Backend: `backend/src/`
- Frontend: `frontend/src/`
- Docs: `docs/`, `specs/002-reservation-checkout-lifecycle/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm repo and runtime ready before schema and code changes.

- [X] T001 Verify API + Postgres start for local dev per repository root `docker-compose.yml` and `backend/README.md`
- [X] T002 [P] Run `backend` TypeScript build (`npm run build` or project equivalent) and fix any pre-existing failures before feature edits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and shared helpers **must** land before user stories that depend on **No-show** or date rules.

**⚠️ CRITICAL**: No user story work should merge until migrations and shared date approach are agreed.

- [X] T003 Add Knex migration under `backend/src/database/migrations/` extending `reservations` status CHECK constraint to include `No-show` (and keep existing values)
- [X] T004 [P] Align reservation `status` TypeScript unions and validation in `backend/src/services/reservations/` (e.g. `reservations_controller.ts`, types files if present)
- [X] T005 [P] Align check-in validation types for blocked statuses in `backend/src/services/check_ins/check_ins_types.ts` and `backend/src/services/check_ins/check_ins_service.ts`
- [X] T006 Implement hotel-local “today” comparison helper using property timezone from `backend/src/services/settings/` (or new `backend/src/utils/hotel_date.ts`) for check-in/check-out date guards
- [X] T007 [P] Update `docs/DATABASE_SCHEMA.md` — `reservations.status` allowed values include `No-show`
- [X] T008 [P] Update `docs/ERD.md` if reservation status enumeration is documented there

**Checkpoint**: Migrations apply cleanly; types compile; docs reflect **No-show**.

---

## Phase 3: User Story 1 — Complete stay through check-out (Priority: P1) 🎯 MVP

**Goal**: Confirmed → check-in → check-out with invoice (default or custom amount), date guards, blocked terminal statuses; checkout survives invoice failure.

**Independent Test**: [quickstart.md](./quickstart.md) §1–§2; `POST .../check-in` then `PATCH .../checkout` with/without `amount`.

### Implementation for User Story 1

- [X] T009 [US1] Enforce `reservations.check_in` ≤ hotel-local today before check-in in `backend/src/services/check_ins/check_ins_service.ts` (`checkInGuest`)
- [X] T010 [US1] Enforce `reservations.check_out` ≤ hotel-local today before check-out in `backend/src/services/check_ins/check_ins_service.ts` (`checkOutGuest`)
- [X] T011 [US1] Reject check-in when reservation `status` is `Cancelled` or `No-show` in `backend/src/services/check_ins/check_ins_service.ts`
- [X] T012 [US1] Extend `CheckOutRequest` with optional `amount` in `backend/src/services/check_ins/check_ins_types.ts`
- [X] T013 [US1] Create invoice row on successful check-out path in `backend/src/services/check_ins/check_ins_service.ts` (reuse insert logic from `backend/src/services/invoices/` or extract shared creator to avoid duplication)
- [X] T014 [US1] Default invoice `amount` from reservation-calculated total; apply request `amount` when provided; log audit when final ≠ calculated default via `backend/src/services/audit/audit_utils.ts` from `backend/src/services/check_ins/check_ins_controller.ts`
- [X] T015 [US1] If invoice insert fails, still complete check-out state updates in `backend/src/services/check_ins/check_ins_service.ts` and return/log error per spec
- [X] T016 [US1] Return created invoice summary in checkout JSON response from `backend/src/services/check_ins/check_ins_controller.ts` (`checkOutHandler`)
- [X] T017 [US1] Date guard coverage via `backend/src/utils/__tests__/hotel_date.test.ts` (legacy `check_ins_service.test.ts` remains skipped)
- [X] T018 [US1] Add optional `amount` to checkout API call in `frontend/src/store/checkInsStore.js` and wire check-out UI in `frontend/src/pages/ReservationsPage.jsx` (or check-in modal component if split)

**Checkpoint**: End-to-end happy path + custom amount + invoice failure path behave per [spec.md](./spec.md) FR-001–FR-004, FR-008, FR-013 (room move overlap deferred to US2 if same file conflict — prefer completing T019 after T013).

---

## Phase 4: User Story 2 — Create and maintain reservations (Priority: P1)

**Goal**: **Cancelled** / **No-show** transitions, inventory release, restrict edits on terminal states; **changeRoom** overlap validation.

**Independent Test**: [quickstart.md](./quickstart.md) §3–§4; PATCH reservation to **No-show**; attempt invalid updates.

### Implementation for User Story 2

- [X] T019 [US2] Add `PATCH` (or `POST`) path for staff to set `No-show` from `Confirmed` with audit in `backend/src/services/reservations/reservations_controller.ts` and `backend/src/routes.ts` if needed
- [X] T020 [US2] Ensure **Cancelled** and **No-show** release reserved nights / room availability consistently in `backend/src/services/reservations/reservations_controller.ts` (overlap helpers, room status if applicable)
- [X] T021 [US2] Block disallowed field updates when `status` is `Checked-out`, `Cancelled`, or `No-show` in `backend/src/services/reservations/reservations_controller.ts` (`updateReservationHandler`)
- [X] T022 [US2] Validate `new_room_id` has no overlapping active reservations through `reservations.check_out` in `backend/src/services/check_ins/check_ins_service.ts` (`changeRoom`)
- [X] T023 [US2] Expose **No-show** action and status badges in `frontend/src/pages/ReservationsPage.jsx` and sync `frontend/src/store/reservationsStore.js`

**Checkpoint**: US1 + US2 both hold; reservation maintenance matches FR-005, FR-006, FR-012.

---

## Phase 5: User Story 3 — Find, open, schedule views (Priority: P2)

**Goal**: Lists and calendar reflect all lifecycle states for planning.

**Independent Test**: Search/filter and `frontend/src/pages/CalendarPage.jsx` show **No-show** / **Cancelled** appropriately.

### Implementation for User Story 3

- [X] T024 [US3] Ensure list/filter query params support new statuses in `backend/src/services/reservations/reservations_controller.ts` (`getReservations` / list handler)
- [X] T025 [P] [US3] Update reservation calendar rendering for terminal states in `frontend/src/pages/CalendarPage.jsx`
- [X] T026 [P] [US3] Ensure detail drawer/modal shows current `check_ins` / room assignment summary for operations in `frontend/src/pages/ReservationsPage.jsx`

**Checkpoint**: Operations staff can locate and distinguish stays by status.

---

## Phase 6: User Story 4 — Invoice and payment completion (Priority: P2)

**Goal**: Manual invoice create with default + custom total and audit; align with UC-401.

**Independent Test**: `POST /api/v1/invoices` with overridden amount; audit entry.

### Implementation for User Story 4

- [X] T027 [US4] Support default total from reservation + optional body `amount` with audit on override in `backend/src/services/invoices/invoices_controller.ts` (and service layer if extracted)
- [ ] T028 [P] [US4] Optional: add `calculated_amount` / override metadata columns via new migration under `backend/src/database/migrations/` per [data-model.md](./data-model.md)
- [X] T029 [US4] Align manual invoice UI with override flow in `frontend/src/store/invoicesStore.js` and invoice create surface (e.g. `frontend/src/pages/InvoicesPage.jsx` if present)

**Checkpoint**: Manual and checkout invoices both support rolled-up total + override audit.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Docs, contracts, RBAC notes, quickstart validation.

- [X] T030 [P] Update `specs/001-phase0-baseline-spec/contracts/core-api.md` for check-out body (`amount`) and **No-show** reservation updates
- [X] T031 [P] Update `backend/DATABASE.md` with new migration summary if that file tracks schema
- [X] T032 Confirm RBAC for checkout amount override matches [spec.md](./spec.md) Assumptions (Front Desk vs Manager) in `backend/src/services/check_ins/check_ins_routes.ts` and `backend/src/services/invoices/invoices_routes.ts` (or equivalent)
- [X] T033 Run through `specs/002-reservation-checkout-lifecycle/quickstart.md` and fix any gaps found
- [X] T034 [P] Deprecation: log or guard legacy reservation status check-in/out in `backend/src/services/reservations/reservations_controller.ts` so new UI uses Check-ins API only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → **Phase 2** → **Phases 3–6** (US1 can start after Phase 2; US2 tightly follows US1 if sharing `check_ins_service.ts` — sequence T013 before T022 recommended) → **Phase 7**

### User Story Dependencies

- **US1**: After Phase 2. MVP scope.
- **US2**: After Phase 2; coordinate file locks with US1 on `check_ins_service.ts` (finish US1 checkout/invoice before **changeRoom** overlap task or merge in one PR).
- **US3**: After US1/US2 API stable (status filters).
- **US4**: Can overlap with US1 after invoice create path exists; manual invoice tasks independent of checkout UI.

### Parallel Opportunities

- T004 ∥ T005 ∥ T007 ∥ T008 (after T003 migration drafted)
- T025 ∥ T026 (US3 frontend)
- T028 ∥ T030 (migration vs contract doc)
- T031 ∥ T034

---

## Parallel Example: User Story 1 + Foundational

```text
After T003: run T004, T005, T007, T008 in parallel.
After T006: run T009–T011 sequentially, then T012–T016, then T017–T018.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1–2  
2. Complete Phase 3 (US1)  
3. STOP — run quickstart §1–§2 and manual QA  

### Incremental Delivery

1. Add Phase 4 (US2) → QA cancel/no-show + room move overlap  
2. Add Phase 5 (US3) → QA calendar/list  
3. Add Phase 6 (US4) → QA manual invoice override  
4. Phase 7 polish  

### Parallel Team Strategy

- Dev A: Phase 2 migrations + backend check_ins  
- Dev B: Phase 2 docs + frontend US3 after API stubs  
- Merge order: Phase 2 → US1 backend → US1 frontend → US2  

---

## Notes

- [P] tasks = different files, no dependencies  
- [Story] maps to [spec.md](./spec.md) User Stories 1–4  
- Include security-validation (T032) before production; full gate remains Phase 4 per constitution  
- Update `docs/DATABASE_SCHEMA.md` / ERD whenever migration T003/T028 merges  
- Commit after each task or logical group  
