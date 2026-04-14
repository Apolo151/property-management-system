# Tasks: Documentation-then-product alignment (multi-property)

**Input**: Design documents from `/specs/003-docs-code-alignment/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included where success criteria (SC-001, SC-003) require verifiable evidence; paths follow existing `backend/src/**/__tests__/` patterns.

**Organization**: Phases follow user story priority from [spec.md](./spec.md) (P1 → P2). *Note:* [plan.md](./plan.md) Wave A suggests doc updates early—teams may execute Phase 4 (US2) tasks in parallel with Phase 3 (US1) if staffed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no ordering dependency on incomplete tasks in the same phase)
- **[Story]**: `US1`, `US2`, `US3` map to user stories in spec.md

## Path Conventions

- Backend: `backend/src/`, tests under `backend/src/services/<feature>/__tests__/`
- Frontend: `frontend/src/`
- Docs: `docs/`, `specs/001-phase0-baseline-spec/contracts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm prerequisites and route inventory before code changes

- [x] T001 Review `specs/003-docs-code-alignment/plan.md` and `specs/003-docs-code-alignment/quickstart.md` against `backend/README.md` for DB seed and two-hotel verification prerequisites
- [x] T002 [P] Inventory `authenticateToken` vs `hotelContext` middleware order across all `backend/src/services/*/*_routes.ts` files and record findings in PR description or `specs/003-docs-code-alignment/research.md` (appendix)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Property-context semantics and operator docs for middleware—**complete before User Story 1–3 backend verification**

**Checkpoint**: Missing-header behavior defined; README documents dev escape hatch

- [x] T003 Enforce required `X-Hotel-Id` on `hotelContext` in production with JSON body `code: PROPERTY_CONTEXT_REQUIRED`, and gate default UUID behind `ALLOW_DEFAULT_HOTEL` env in `backend/src/services/auth/auth_middleware.ts`
- [x] T004 [P] Document `X-Hotel-Id`, `PROPERTY_CONTEXT_REQUIRED`, and `ALLOW_DEFAULT_HOTEL` (non-production only) in `backend/README.md`

---

## Phase 3: User Story 1 - Operations staff trust property boundaries (Priority: P1) — MVP

**Goal**: Maintenance and audit data are visible and mutable only within the active property; frontend never silently operates in the wrong hotel.

**Independent Test**: [quickstart.md](./quickstart.md) sections 1–2 and 4; two hotels, user assigned only to hotel A.

### Implementation for User Story 1

- [x] T005 [US1] Scope list/get/create/update/delete maintenance handlers by `req.hotelId`, validate `rooms.hotel_id` matches context, and set `hotel_id` on insert in `backend/src/services/maintenance/maintenance_controller.ts`
- [x] T006 [US1] Scope audit log list, count, and get-by-id by `audit_logs.hotel_id === req.hotelId` using `AuthenticatedRequest` in `backend/src/services/audit/audit_controller.ts`
- [x] T007 [P] [US1] Add maintenance tenancy tests (cross-hotel list/detail/create denial) in `backend/src/services/maintenance/__tests__/maintenance_tenancy.test.ts`
- [x] T008 [P] [US1] Add audit tenancy tests (cross-hotel list/detail denial) in `backend/src/services/audit/__tests__/audit_tenancy.test.ts`
- [x] T009 [US1] Adjust login and persistence so only a **single** assigned hotel auto-selects `activeHotelId`; multiple hotels require explicit `switchHotel` before relying on header in `frontend/src/store/authStore.js`
- [x] T010 [P] [US1] Gate operational navigation or show blocking UI when user has multiple hotels but no `activeHotelId` in `frontend/src/layouts/MainLayout.jsx` (and/or route guard in `frontend/src/App.jsx` if used)
- [x] T011 [US1] Map API `PROPERTY_CONTEXT_REQUIRED` and `HOTEL_ACCESS_DENIED` to clear user-visible messages in `frontend/src/utils/api.js`
- [x] T012 [P] [US1] Display current property name (via `useAuthStore` / `getActiveHotel`) on `frontend/src/pages/MaintenancePage.jsx` and `frontend/src/pages/AuditLogsPage.jsx`

**Checkpoint**: User Story 1 acceptance scenarios 1–3 from spec.md satisfied; SC-001 maintenance/audit checks pass

---

## Phase 4: User Story 2 - Canonical documentation matches reality (Priority: P2)

**Goal**: Architecture, schema narrative, and API contract agree on multi-property tenancy and property context with no misleading singleton DDL.

**Independent Test**: [quickstart.md](./quickstart.md) section 5; SC-002 doc review checklist

### Implementation for User Story 2

- [x] T013 [US2] Add **Multi-property tenancy** section (header, middleware order, `user_hotels`, global vs scoped routes, SUPER_ADMIN summary) to `docs/ARCHITECTURE.md`
- [x] T014 [P] [US2] Fix `hotel_settings` section: label legacy DDL as historical or replace with per-`hotel_id` description consistent with migrations in `docs/DATABASE_SCHEMA.md`
- [x] T015 [P] [US2] Align `X-Hotel-Id`, route groups, and error codes with `specs/003-docs-code-alignment/contracts/property-context-and-tenancy.md` in `specs/001-phase0-baseline-spec/contracts/core-api.md`
- [x] T016 [US2] Update maintenance, audit, and users rows in `docs/specs/00-gap-analysis.md` when implementation closes documented gaps

**Checkpoint**: No contradictions across ARCHITECTURE, DATABASE_SCHEMA overview, and core-api for tenancy (SC-002)

---

## Phase 5: User Story 3 - User administration matches documented access rules (Priority: P2)

**Goal**: Session is always validated before role checks; ADMIN cannot assign hotels outside their own assignments.

**Independent Test**: [quickstart.md](./quickstart.md) section 3; spec.md Story 3 acceptance scenarios

### Implementation for User Story 3

- [x] T017 [US3] Apply `authenticateToken` to all routes and apply `hotelContext` only where product policy requires property-scoped user listing (document choice in PR) in `backend/src/services/users/users_routes.ts`
- [x] T018 [US3] Validate `hotel_ids` on create/update: ADMIN may assign only hotels present in their `user_hotels`; SUPER_ADMIN unrestricted in `backend/src/services/users/users_controller.ts`
- [x] T019 [P] [US3] Add test that unauthenticated `GET /api/v1/users` returns 401 in `backend/src/services/users/__tests__/users_auth.test.ts`

**Checkpoint**: SC-003 scenario for user administration satisfied; Story 3 acceptance scenarios 1–3 satisfied

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo quality gates, manual evidence, optional UX polish

- [x] T020 Run `npm test && npm run lint` from repository root `/home/abdallah/Projects/freelance/hotelmanangement` and fix regressions introduced by this feature
- [x] T021 [P] Complete manual verification per `specs/003-docs-code-alignment/quickstart.md` and record pass/fail in PR description or a short note under **Notes** below
- [x] T022 [P] Add or adjust admin-scope hint copy on user management UI in `frontend/src/pages/SettingsPage.jsx` if user CRUD is present (clarity for property-limited vs SUPER_ADMIN)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → **Phase 2** → **Phase 3 (US1)** → **Phase 6** minimal MVP path
- **Phase 4 (US2)** can start after **Phase 2** in parallel with **Phase 3** (documentation does not block backend coding if contracts are merged last—prefer **T015** after **T003** for accuracy)
- **Phase 5 (US3)** depends on **Phase 2**; can parallel **Phase 3** after **T003–T004** if no file conflicts

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 (T003–T004) for strict header semantics
- **US2 (P2)**: Logically depends on finalized behavior for **T015**; **T013–T014** can proceed anytime
- **US3 (P2)**: Independent of US1/US2 except shared `auth_middleware.ts` (coordinate merges)

### Within User Story 1

- T005 → T007; T006 → T008 (tests after controllers)
- T009 before T010–T012 (store state before UI gates)

### Parallel Opportunities

- **Phase 1**: T001 sequential with T002 [P] after T001 started (or fully parallel if two people)
- **Phase 3**: T007 [P] + T008 [P] after T005–T006; T010 [P] + T012 [P] after T009; T011 can parallel T012
- **Phase 4**: T014 [P] + T015 [P] parallel; T013 before or parallel T014
- **Phase 6**: T021 [P] + T022 [P] parallel after T020

---

## Parallel Example: User Story 1

```text
After T005 and T006 complete:
- T007 [US1] maintenance_tenancy.test.ts
- T008 [US1] audit_tenancy.test.ts

After T009 complete:
- T010 [US1] MainLayout.jsx / App.jsx gate
- T012 [US1] MaintenancePage.jsx + AuditLogsPage.jsx (both [P] if split between two files—same story, two paths)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1–2  
2. Complete Phase 3 (US1)  
3. Run T020 focused on backend/frontend touched files if full monorepo lint is heavy  
4. **STOP**: Execute quickstart §1–2 and §4; demo two-hotel isolation

### Documentation-first variant (per plan.md Wave A)

1. Complete Phase 2 (T003–T004)  
2. Run **Phase 4** T013–T016 in parallel with **Phase 3** T005–T012 where possible  
3. Finish **T015** once middleware and error codes are stable

### Incremental Delivery

1. US1 → verify SC-001  
2. US2 → verify SC-002  
3. US3 → verify SC-003  
4. Phase 6 → full lint/test + quickstart sign-off

---

## Notes

- T002 finding: recorded in `specs/003-docs-code-alignment/research.md` appendix (route middleware inventory).
- T021 manual run results: run `specs/003-docs-code-alignment/quickstart.md` against a two-hotel environment when DB is available; automated coverage: `npm test` in `backend/`.  
- All tasks use checklist format: `- [ ] Tnnn [P] [USn] Description with file path`

---

## Task summary

| Phase | Task IDs | Count |
|-------|-----------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T004 | 2 |
| US1 | T005–T012 | 8 |
| US2 | T013–T016 | 4 |
| US3 | T017–T019 | 3 |
| Polish | T020–T022 | 3 |
| **Total** | **T001–T022** | **22** |

**Parallel opportunities**: T002 [P]; T004 [P] with T003 if README drafted alongside middleware; T007–T008 [P]; T010–T012 partial [P]; T014–T015 [P]; T019 [P]; T021–T022 [P]

**Suggested MVP scope**: Phases 1–3 + T020 (tests covering changed packages)
