# Tasks: Frontend Audit & Comprehensive Fix

**Input**: Design documents from `/home/abdallah/Projects/freelance/hotelmanangement/specs/006-frontend-audit-fix/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`  
**Tests**: No automated test tasks (not requested in spec). Verification via Storybook and `quickstart.md` manual steps.

**Organization**: Phases follow user-story priorities from `spec.md`. Phase 2 is blocking for all story-specific work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies within the same phase)
- **[Story]**: `US1`–`US10` maps to user stories in `spec.md`
- Paths are under repository root; frontend work uses `frontend/`

## Path Conventions

- **Web app**: `backend/`, `frontend/` (this feature touches **frontend only**)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add Storybook tooling so Phase 10 (US9) can proceed without rework.

- [X] T001 [P] Add Storybook `devDependencies` (`storybook`, `@storybook/react-vite`, `@storybook/addon-essentials`, `@storybook/addon-interactions` aligned to same `^8.6.x`) and `storybook` / `build-storybook` scripts to `frontend/package.json` per `specs/006-frontend-audit-fix/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Store registry, domain resets, slim `useStore`, remove phantom notifications, hotel switch without reload, and tenant-scoped refetch. **No user story work should start before this phase completes.**

**⚠️ CRITICAL**: Completes User Story 3 (useStore elimination) and most of User Story 6 (hotel switch).

- [X] T002 Create `frontend/src/store/storeRegistry.js` with `registerDomainReset` and `resetAllDomainStores` per `specs/006-frontend-audit-fix/data-model.md`
- [X] T003 [P] Add `reset()` using `set(api.getInitialState(), true)` and call `registerDomainReset` in `frontend/src/store/reservationsStore.js`
- [X] T004 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/guestsStore.js`
- [X] T005 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/roomsStore.js`
- [X] T006 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/roomTypesStore.js`
- [X] T007 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/checkInsStore.js`
- [X] T008 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/invoicesStore.js`
- [X] T009 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/expensesStore.js`
- [X] T010 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/maintenanceStore.js`
- [X] T011 [P] Add `reset()` and `registerDomainReset` in `frontend/src/store/auditLogsStore.js`
- [X] T012 [P] Create `frontend/src/utils/dateUtils.js` exporting `safeFormat(dateStr, fmt, fallback)` per `specs/006-frontend-audit-fix/contracts/ui-component-contracts.md`
- [X] T013 Refactor `frontend/src/store/useStore.js` to only `darkMode` and `toggleDarkMode`; remove all JSON imports and domain state/actions per FR-001, FR-003
- [X] T014 Remove notification-generation `useEffect` and all `useStore` usage from `frontend/src/App.jsx` per FR-002
- [X] T015 Update `frontend/src/store/authStore.js` so `switchHotel` calls `resetAllDomainStores()` after persisting `activeHotelId` per FR-010
- [X] T016 Remove `window.location.reload()` from `handleHotelSwitch` in `frontend/src/layouts/MainLayout.jsx` per FR-010
- [X] T017 Add `activeHotelId` from `useAuthStore` to `useEffect` dependency arrays for initial tenant data fetches across `frontend/src/pages/*.jsx` (and layout children) where API calls require `X-Hotel-Id` per `specs/006-frontend-audit-fix/plan.md`

**Checkpoint**: App boots; dark mode works; no JSON mock imports at runtime; hotel switch clears stores and refetches without full reload.

---

## Phase 3: User Story 1 — Notifications Show Real-time Server Data (Priority: P1)

**Goal**: Bell shows only server-persisted notifications; no client-side duplication from mock store.

**Independent Test**: Log in; open bell; count matches server; no duplicates from old `useStore` loop (removed in Phase 2).

- [X] T018 [US1] Remove any unused imports (e.g. `date-fns` helpers) left in `frontend/src/App.jsx` after T014

**Checkpoint**: US1 satisfied together with Phase 2 T013–T014; T018 is cleanup only.

---

## Phase 4: User Story 2 — Reservation List Actions Complete (Priority: P1)

**Goal**: Cancel (UC-304) and edit dates (UC-311) from Reservations page via existing `PUT /v1/reservations/:id`.

**Independent Test**: Cancel a Confirmed reservation; edit dates on a Confirmed reservation; list and badges update.

- [X] T019 [US2] Add Cancel reservation action with `useConfirmation` and `updateReservation` in `frontend/src/pages/ReservationsPage.jsx` for statuses allowed by FR-004
- [X] T020 [US2] Add Edit dates modal (check-in/check-out), validation, and `updateReservation` in `frontend/src/pages/ReservationsPage.jsx` per FR-005

**Checkpoint**: US2 flows work end-to-end against backend.

---

## Phase 5: User Story 3 — Legacy useStore Mock Data Eliminated (Priority: P1)

**Goal**: Confirm no runtime imports from `frontend/src/data/*.json`.

**Independent Test**: `grep` shows no `data/*.json` imports under `frontend/src/`.

- [X] T021 [US3] Search `frontend/src/` for imports from `data/` or `*.json`; remove any remaining runtime imports per FR-001

**Checkpoint**: US3 fully verified after Phase 2 implementation.

---

## Phase 6: User Story 4 — Runtime Crash Guards on Date Parsing (Priority: P2)

**Goal**: No throws on null dates; stable sorts for UUIDs; guest profile loads on direct URL.

**Independent Test**: Check-ins page with null `expected_checkout_time`; invoice sort with null dates; guest list sort by id; open `/guests/:id` after refresh.

- [X] T022 [US4] Apply `safeFormat` for `expected_checkout_time` and related date displays, and add `dark:` Tailwind variants to stats cards in `frontend/src/pages/CheckInsPage.jsx` per FR-007 and FR-016
- [X] T023 [P] [US4] Harden invoice table sort for null/undefined `issueDate` and `dueDate` in `frontend/src/pages/InvoicesPage.jsx` per FR-008
- [X] T024 [P] [US4] Fix guest sort-by-id to use `String(a.id).localeCompare(String(b.id))` (or name fallback) in `frontend/src/pages/GuestsPage.jsx` per FR-009
- [X] T025 [US4] Call `fetchGuest(id)` on mount when guest is missing from store in `frontend/src/pages/GuestProfilePage.jsx` per FR-012

**Checkpoint**: US4 scenarios pass with realistic null/UUID data.

---

## Phase 7: User Story 5 — useMemo Dependency Arrays Correct (Priority: P2)

**Goal**: Reservation sort direction updates immediately; Dashboard memos accurate.

**Independent Test**: Toggle sort on Reservations twice; Dashboard loads without redundant memo deps.

- [X] T026 [US5] Add `sortOrder` to `useMemo` deps for `filteredAndSortedReservations` in `frontend/src/pages/ReservationsPage.jsx` per FR-006
- [X] T027 [US5] Fix `stats` `useMemo` in `frontend/src/pages/DashboardPage.jsx`: remove `reportStats` from deps if unused, or use it inside the memo per acceptance in `spec.md`

**Checkpoint**: US5 sort and memo behavior matches spec.

---

## Phase 8: User Story 6 — Hotel Switch Without Full Page Reload (Priority: P2)

**Goal**: Behavior verified after Phase 2; document any gaps.

**Independent Test**: Switch property on `/reservations`; list updates; no full reload (see `quickstart.md` §3).

- [X] T028 [US6] Walk through `specs/006-frontend-audit-fix/quickstart.md` §3 and fix any page that still shows stale data after hotel switch (adjust `useEffect` deps or explicit refetch in `frontend/src/pages/`)

**Checkpoint**: US6 verified across primary operational pages.

---

## Phase 9: User Story 7 — Invoice PDF Download in UI (Priority: P2)

**Goal**: UC-407 — download PDF from Invoices page.

**Independent Test**: Click Download PDF; file saves; errors toast.

- [X] T029 [US7] Add Download PDF control and blob download using `api.invoices.downloadPdf` in `frontend/src/pages/InvoicesPage.jsx` per FR-011 and `contracts/ui-component-contracts.md`

**Checkpoint**: US7 works for invoices where backend returns PDF.

---

## Phase 10: User Story 8 — RBAC-Aware UI (Priority: P3)

**Goal**: Hide create/destructive actions and sensitive nav per role per FR-018.

**Independent Test**: Log in as `VIEWER`; no Add/Cancel on Reservations; housekeeping hides financial nav per spec.

- [X] T030 [US8] Create `frontend/src/hooks/usePermissions.js` mapping `useAuthStore().user.role` to flags per `specs/006-frontend-audit-fix/data-model.md`
- [X] T031 [P] [US8] Filter sidebar `navigation` items in `frontend/src/layouts/MainLayout.jsx` using `usePermissions` per US8 acceptance (e.g. housekeeping vs financials)
- [X] T032 [US8] Gate Add/Cancel/Edit and other destructive or privileged actions on `frontend/src/pages/ReservationsPage.jsx` (and other high-risk pages as needed) using `usePermissions`

**Checkpoint**: US8 matches minimum FR-018 scope; backend remains source of truth for authorization.

---

## Phase 11: User Story 9 — Storybook Setup (Priority: P3)

**Goal**: `npm run storybook` runs; nine component stories render in isolation.

**Independent Test**: Storybook at `http://localhost:6006`; open each listed story.

- [X] T033 [US9] Create `frontend/.storybook/main.js` and `frontend/.storybook/preview.jsx` importing `frontend/src/index.css` and optional `MemoryRouter` decorator per `research.md`
- [X] T034 [P] [US9] Add `frontend/src/components/Modal.stories.jsx`
- [X] T035 [P] [US9] Add `frontend/src/components/StatusBadge.stories.jsx`
- [X] T036 [P] [US9] Add `frontend/src/components/StatCard.stories.jsx`
- [X] T037 [P] [US9] Add `frontend/src/components/SearchInput.stories.jsx`
- [X] T038 [P] [US9] Add `frontend/src/components/FilterSelect.stories.jsx`
- [X] T039 [P] [US9] Add `frontend/src/components/ToastNotification.stories.jsx` (or toast surface per existing component API)
- [X] T040 [P] [US9] Add `frontend/src/components/ConfirmationDialog.stories.jsx` (seed `confirmationStore` or wrapper per `contracts/ui-component-contracts.md`)
- [X] T041 [P] [US9] Add `frontend/src/components/GuestSelect.stories.jsx` with mock `guests` props
- [X] T042 [P] [US9] Add `frontend/src/components/CheckInModal.stories.jsx` with mock `reservation` prop

**Checkpoint**: US9 — all FR-013 components have stories; `npm run build-storybook` succeeds.

---

## Phase 12: User Story 10 — Notifications Polling (Priority: P3)

**Goal**: Unread badge updates within ~30s without opening the panel.

**Independent Test**: Create server notification; wait; badge updates; dropdown open refreshes list.

- [X] T043 [US10] Create `frontend/src/hooks/usePolling.js` per `specs/006-frontend-audit-fix/research.md`
- [X] T044 [US10] Integrate `usePolling`, visibility gating, and in-flight guard into `frontend/src/components/Notifications.jsx` per FR-014

**Checkpoint**: US10 acceptance scenarios in `spec.md` pass.

---

## Phase 13: Polish & Cross-Cutting (FR-015, FR-017)

**Purpose**: Dashboard honesty, reservation performance, build verification.

- [X] T045 Remove fabricated "Last Month" cancellation comparison from `frontend/src/pages/DashboardPage.jsx` per FR-015
- [X] T046 Remove per-room N+1 availability calls in `frontend/src/pages/ReservationsPage.jsx`; rely on room-type availability result per FR-017
- [X] T047 Run `npm install` and `npm run build` in `frontend/`; fix compile errors until green
- [ ] T048 [P] Run `specs/006-frontend-audit-fix/quickstart.md` manual verification sections 1–6 and note results in PR description

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Depends On |
|-------|------------|
| Phase 1 Setup | Nothing |
| Phase 2 Foundational | Phase 1 (Storybook deps available for later); **blocks Phases 3–13** |
| Phases 3–5 (US1–US3) | Phase 2 |
| Phases 6–12 (US4–US10) | Phase 2 (US4–US7 can overlap with US8–US10 after Phase 2 if staffed) |
| Phase 13 Polish | T026–T027, T019–T020 recommended before T046 (Reservations page stable) |

### User Story Dependencies

| Story | Depends On | Notes |
|-------|------------|-------|
| US1 | Phase 2 T013–T014 | T018 cleanup |
| US2 | Phase 2 | Uses `updateReservation` in existing store |
| US3 | Phase 2 T013 | T021 verification |
| US4 | Phase 2 T012 | Uses `safeFormat` |
| US5 | Phase 2 | Reservations + Dashboard pages |
| US6 | Phase 2 T015–T017 | T028 validation pass |
| US7 | Phase 2 | Invoices page |
| US8 | Phase 2 | Auth user present |
| US9 | Phase 1 T001 | Storybook packages |
| US10 | Phase 2 | Notifications component |
| Polish | Prefer US2 + US5 + US7 done before heavy Reservations edits (T046) |

### Parallel Opportunities

- **Phase 2**: T003–T011 (store resets) after T002; T012 can run in parallel with T003–T011 (separate file; no dependency on registry).
- **Phase 6**: T023 and T024 are parallelizable (Invoices vs Guests); T022 and T025 are single-file work within US4.
- **Phase 11 (US9)**: T034–T042 are parallel story files after T033 creates `.storybook/`.
- **Phase 13**: T048 can run after T047 build is green.

### Parallel Example (US9)

After T033, one developer can add `Modal.stories.jsx` (T034) while another adds `StatCard.stories.jsx` (T036) and `GuestSelect.stories.jsx` (T041); no cross-file conflicts.

### Implementation Strategy

1. **MVP**: Phase 1 + Phase 2 + Phase 3 (US1) — stable auth, tenant reset, real notifications path.
2. **Incremental**: US2 → US3 verification → US4/US5 (page fixes) → US6 validation → US7 PDF → US8 RBAC → US9 Storybook → US10 polling → Phase 13 polish + build + manual QA.

### Notes

- **Format**: Every task line uses `- [ ] Tnnn …` with a concrete `frontend/…` path (or `specs/006-frontend-audit-fix/quickstart.md` for T048).
- **Total tasks**: 48 (T001–T048); sequential IDs, no duplicates.
