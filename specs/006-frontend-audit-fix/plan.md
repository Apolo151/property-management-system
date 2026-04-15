# Implementation Plan: Frontend Audit & Comprehensive Fix

**Branch**: `006-frontend-audit-fix` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/006-frontend-audit-fix/spec.md`

---

## Summary

Fix all runtime bugs, misalignments with the USE_CASES specification, anti-patterns, and missing features in the frontend codebase identified during a systematic file-by-file audit. The approach eliminates the dual-store antipattern (mock JSON data in `useStore.js`), adds missing reservation actions (Cancel, Edit Dates), wires the existing invoice PDF endpoint to a UI button, adds notification polling, adds a RBAC-aware permission hook, installs Storybook with 9 component stories for isolated manual testing, and replaces the brute-force `window.location.reload()` hotel switch with a clean store-reset flow. No backend changes required.

---

## Technical Context

**Language/Version**: React 18.2 JSX (frontend only); no TypeScript  
**Primary Dependencies**: React 18, Vite 5, Zustand 5, react-router-dom 6, Tailwind CSS 3, date-fns 2, Recharts 3  
**Storage**: `localStorage` for auth tokens and UI preferences; all entity data from REST API  
**Testing**: Storybook v8 (`@storybook/react-vite`) for manual component testing; no automated test runner currently in frontend  
**Target Platform**: Browser (desktop + mobile responsive)  
**Project Type**: Web application (SPA)  
**Performance Goals**: Hotel switch < 2s; notification badge update < 30s; no page reload on hotel switch  
**Constraints**: No new backend endpoints; no new runtime npm dependencies except Storybook devDeps; minimal-change approach (KISS)  
**Scale/Scope**: ~15 pages, ~14 components, ~11 stores; approximately 18 functional requirement changes across ~12 files

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

- [x] **Architecture preserved**: All changes stay within existing React/Vite/Zustand/Tailwind stack. No new runtime frameworks introduced. Storybook is devDependency only.
- [x] **Core-first scope**: This feature exclusively fixes core PMS workflows (reservations, check-ins, guests, invoices, notifications) before any channel-manager work. All 18 requirements are core PMS scope.
- [x] **Security gate planned**: RBAC-aware UI (FR-018) is included; `usePermissions()` hook hides destructive actions from VIEWER/HOUSEKEEPING roles. Backend RBAC enforcement is unchanged (already present). No new secrets or auth changes. Notifications are user-scoped via server API (removes risk of cross-user phantom notifications from mock data).
- [x] **Traceability guaranteed**: All 18 FRs trace to identified source file lines, specific use cases (UC-304, UC-311, UC-407, UC-1101–1106), and acceptance scenarios in the spec.
- [x] **Incremental verification**: Each phase has exit criteria. Storybook stories provide independent component verification. Phase exit = all FRs with Storybook story and/or API integration test passing in browser.

**Post-design re-check**: ✓ No violations found. Data model adds only additive changes (new hooks, refactored store). No schema or API contract changes introduced.

---

## Project Structure

### Documentation (this feature)

```text
specs/006-frontend-audit-fix/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── ui-component-contracts.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (affected files)

```text
frontend/
├── .storybook/
│   ├── main.js                         [NEW] Storybook config
│   └── preview.js                      [NEW] global decorators + Tailwind import
├── src/
│   ├── App.jsx                         [MODIFY] remove notification generation loop
│   ├── layouts/
│   │   └── MainLayout.jsx              [MODIFY] hotel switch: store reset, no reload
│   ├── hooks/
│   │   ├── usePolling.js               [NEW] polling hook
│   │   └── usePermissions.js           [NEW] RBAC permissions hook
│   ├── store/
│   │   ├── useStore.js                 [MODIFY] keep only darkMode + toggleDarkMode
│   │   ├── storeRegistry.js            [NEW] domain store reset registry
│   │   ├── reservationsStore.js        [MODIFY] add reset(), register
│   │   ├── guestsStore.js              [MODIFY] add reset(), register
│   │   ├── roomsStore.js               [MODIFY] add reset(), register
│   │   ├── roomTypesStore.js           [MODIFY] add reset(), register
│   │   ├── checkInsStore.js            [MODIFY] add reset(), register
│   │   ├── invoicesStore.js            [MODIFY] add reset(), register
│   │   ├── expensesStore.js            [MODIFY] add reset(), register
│   │   ├── maintenanceStore.js         [MODIFY] add reset(), register
│   │   └── auditLogsStore.js           [MODIFY] add reset(), register
│   ├── utils/
│   │   └── dateUtils.js                [NEW] safeFormat helper
│   ├── components/
│   │   ├── Notifications.jsx           [MODIFY] add polling (usePolling)
│   │   ├── StatusBadge.stories.jsx     [NEW]
│   │   ├── StatCard.stories.jsx        [NEW]
│   │   ├── Modal.stories.jsx           [NEW]
│   │   ├── SearchInput.stories.jsx     [NEW]
│   │   ├── FilterSelect.stories.jsx    [NEW]
│   │   ├── ToastNotification.stories.jsx [NEW]
│   │   ├── ConfirmationDialog.stories.jsx [NEW]
│   │   ├── GuestSelect.stories.jsx     [NEW]
│   │   └── CheckInModal.stories.jsx    [NEW]
│   └── pages/
│       ├── DashboardPage.jsx           [MODIFY] remove fake cancellation chart bar
│       ├── ReservationsPage.jsx        [MODIFY] fix useMemo deps, add Cancel+Edit actions, remove N+1 loop
│       ├── CheckInsPage.jsx            [MODIFY] null guard on dates, dark mode stats
│       ├── InvoicesPage.jsx            [MODIFY] null guard in sort, add PDF download button
│       ├── GuestsPage.jsx              [MODIFY] fix UUID sort
│       └── GuestProfilePage.jsx        [MODIFY] add fetchGuest(id) on not-found
└── package.json                        [MODIFY] add storybook devDeps + scripts
```

---

## Phase 0: Research Output

Research complete. See [`research.md`](./research.md) for all decisions and rationale.

**Key resolved decisions**:
1. Storybook v8 (`@storybook/react-vite`) is the correct package for Vite 5 + React 18.
2. Zustand v5 store reset via `setState(getInitialState(), true)` + domain registry pattern.
3. `usePolling` hook with ref-stabilized callback + `visibilityState` gating + `inFlight` guard.
4. Dual-store elimination: `useStore.js` → `{ darkMode, toggleDarkMode }` only.
5. RBAC via `usePermissions()` hook reading `user.role` from `authStore`.
6. Cancel/Edit reservation via existing `PUT /v1/reservations/:id` endpoint.
7. PDF download via existing `api.invoices.downloadPdf(id)` → Blob → `<a>` trigger.
8. Crash guards via `safeFormat(dateStr, fmt, fallback)` utility.

---

## Phase 1: Design Output

Design complete. Artifacts:
- [`data-model.md`](./data-model.md) — store shapes, permission matrix, state transitions
- [`contracts/ui-component-contracts.md`](./contracts/ui-component-contracts.md) — component prop interfaces, API contracts

**No schema changes. No new backend endpoints. All fixes are frontend-only.**

---

## Implementation Phases

### Phase A: Foundation (Blockers for everything else)
*Must be completed first as all other changes depend on clean data flow.*

1. **Eliminate dual-store antipattern**
   - Refactor `useStore.js` to `{ darkMode, toggleDarkMode }` only
   - Remove all JSON data file imports from `useStore.js`
   - Remove `useStore()` call from `App.jsx`
   - Remove notification generation `useEffect` from `App.jsx`

2. **Create store registry + add `reset()` to all domain stores**
   - New file: `src/store/storeRegistry.js`
   - Add `reset()` action + `registerDomainReset()` call to all 9 domain stores
   - Update `authStore.switchHotel` to call `resetAllDomainStores()` instead of `window.location.reload()`

3. **Create `dateUtils.js`**
   - `safeFormat(dateStr, fmt, fallback)` utility

**Phase A exit criteria**: App loads, all pages render without errors, dark mode works, no JSON data file imports in runtime code.

---

### Phase B: Bug Fixes (Runtime correctness)
*Parallelizable after Phase A.*

4. **`CheckInsPage.jsx` — null date guard**
   - Replace `format(parseISO(expected_checkout_time))` with `safeFormat(...)`
   - Add `dark:` variants to stats cards (bg-blue-50 → dark:bg-blue-900/30, etc.)

5. **`InvoicesPage.jsx` — null date sort + PDF button**
   - Guard date sort with null checks
   - Add "Download PDF" button for each invoice row

6. **`GuestsPage.jsx` — UUID sort fix**
   - Replace `Number(a.id) - Number(b.id)` with `String(a.id).localeCompare(String(b.id))`

7. **`ReservationsPage.jsx` — useMemo deps + N+1 removal**
   - Add `sortOrder` to `filteredAndSortedReservations` useMemo deps
   - Remove per-room availability check loop; use `availableRoomTypes` result directly

8. **`DashboardPage.jsx` — remove fake chart data**
   - Remove "Last Month" bar from cancellation chart (was `rate * 1.1`)

9. **`GuestProfilePage.jsx` — fetch on direct navigation**
   - Add `useEffect` that calls `fetchGuest(id)` when `guest` is not found in store

**Phase B exit criteria**: All 9 identified crashes/bugs cannot be reproduced with real backend data.

---

### Phase C: Missing Features (UX completeness)
*Parallelizable after Phase A.*

10. **`ReservationsPage.jsx` — Cancel + Edit Reservation actions**
    - Add Cancel button (for Confirmed, No-show statuses)
    - Add Edit Dates modal (for Confirmed status only)
    - Wire to `updateReservation()` in `reservationsStore`

11. **`Notifications.jsx` — polling**
    - Create `src/hooks/usePolling.js`
    - Add 30s polling with visibility gating and inFlight guard

12. **`usePermissions` hook + RBAC-aware buttons**
    - Create `src/hooks/usePermissions.js`
    - Apply to ReservationsPage (hide Add/Cancel for VIEWER)
    - Apply to other pages with destructive actions

**Phase C exit criteria**: Cancel/Edit reservation works end-to-end; notification badge updates within 30s; VIEWER role sees no create/delete buttons.

---

### Phase D: Storybook (Manual testing infra)
*Independent from A/B/C, can start anytime.*

13. **Install Storybook**
    - Add devDependencies to `frontend/package.json`
    - Create `.storybook/main.js` and `.storybook/preview.js`
    - Add `storybook` and `build-storybook` scripts

14. **Write 9 component stories**
    - `StatusBadge.stories.jsx` — all status variants
    - `StatCard.stories.jsx` — various value types
    - `Modal.stories.jsx` — open/close states
    - `SearchInput.stories.jsx`
    - `FilterSelect.stories.jsx`
    - `ToastNotification.stories.jsx` — all toast types
    - `ConfirmationDialog.stories.jsx` — confirm/cancel flows
    - `GuestSelect.stories.jsx` — search and create-new flows
    - `CheckInModal.stories.jsx` — with mock reservation

**Phase D exit criteria**: `npm run storybook` starts cleanly; all 9 stories render correctly in isolation without backend.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Some page reads removed `useStore` data after refactor | Medium | Medium | Grep all files for `useStore()` usage before removing fields; migrate any remaining reads to domain stores |
| Storybook 8 incompatibility with Vite 5 alias config | Low | Low | Use `viteFinal` merge if aliases needed; stories confirmed not to need alias resolution |
| Hotel switch store reset misses a store | Low | Low | Registry pattern ensures completeness; verify by checking all `registerDomainReset` calls |
| `PUT /v1/reservations/:id` with `status: Cancelled` not idempotent | Low | Medium | Add guard: skip API call if status is already Cancelled |
| `useEffect([activeHotelId])` causes double-fetch on initial load | Medium | Low | Add `previousHotelId` ref check to skip re-fetch when `hotelId` hasn't actually changed |

---

## Phase Exit Criteria

| Phase | Exit Criteria | Evidence |
|-------|---------------|----------|
| A (Foundation) | App loads, dark mode works, no JSON imports at runtime | `grep -r "from.*data/" src/` returns no matches |
| B (Bug Fixes) | No runtime crashes on real backend data | Manual test: navigate all pages with null-date records |
| C (Features) | Cancel reservation, PDF download, notification polling all work | Manual smoke test per quickstart.md |
| D (Storybook) | All 9 stories render in Storybook | `npm run storybook` → visit each story |
