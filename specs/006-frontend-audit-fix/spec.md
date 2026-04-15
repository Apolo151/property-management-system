# Feature Specification: Frontend Audit & Comprehensive Fix

**Feature Branch**: `006-frontend-audit-fix`  
**Created**: 2026-04-15  
**Status**: Draft  

---

## User Scenarios & Testing

### User Story 1 — Notifications Show Real-time Server Data (Priority: P1)

Staff members rely on notifications for check-in reminders, maintenance alerts, and housekeeping alerts. Currently the app generates notifications client-side from stale mock JSON data in `useStore.js`, duplicating and conflicting with the correct server-driven `Notifications` component. Staff see phantom or duplicate notifications based on old data.

**Why this priority**: Notifications are a primary operational signal used by front desk, housekeeping, and maintenance staff. Broken notifications directly impede daily operations and are visible to all users on every page.

**Independent Test**: Log in, verify the bell icon shows only real server notifications (no phantom/duplicated ones), confirm that completing a check-in creates a server notification visible to eligible staff.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** the header loads, **Then** the notification count reflects only unread server-persisted notifications, not locally generated duplicates.
2. **Given** a check-in event occurs, **When** the user opens the notification dropdown, **Then** the new check-in notification appears without manually refreshing.
3. **Given** `App.jsx` runs on mount, **When** reservations or invoices change, **Then** no client-side `addNotification()` calls are made from `useStore`.

---

### User Story 2 — Reservation List Actions Are Complete (Priority: P1)

Front desk staff need to cancel reservations and update reservation details (dates, guest). Currently neither "Cancel Reservation" (UC-304) nor "Modify Reservation Dates" (UC-311) are accessible from the Reservations page. The only available actions are "Check In", "No-show", and "Create Invoice".

**Why this priority**: Cancellation is a daily front desk operation. Inability to cancel from the UI forces manual backend intervention.

**Independent Test**: Open Reservations page, click Cancel on a Confirmed reservation, confirm the status changes to Cancelled and the room is released; then edit dates on a Confirmed reservation and save.

**Acceptance Scenarios**:

1. **Given** a reservation with status `Confirmed`, **When** staff clicks "Cancel", **Then** a confirmation dialog appears, and on confirm the reservation status updates to `Cancelled`.
2. **Given** a reservation with status `Confirmed`, **When** staff clicks "Edit", **Then** a modal allows changing check-in/check-out dates with availability validation before saving.
3. **Given** a cancelled reservation, **When** the list refreshes, **Then** the cancelled reservation shows a `Cancelled` status badge and no check-in or edit actions are available.

---

### User Story 3 — Legacy `useStore` Mock Data Is Eliminated (Priority: P1)

`useStore.js` imports static JSON files (`guests.json`, `rooms.json`, `reservations.json`) and seeds the Zustand store with mock data. Although feature-specific stores (reservationsStore, guestsStore, etc.) now call the real API, `App.jsx` still reads from `useStore` for notification logic and `MainLayout` reads `darkMode` from it. All data-bearing state in `useStore` (guests, rooms, reservations, invoices, housekeeping, maintenanceRequests, expenses, auditLogs, notifications) should be removed or delegated to the domain stores. `darkMode` can remain as a UI preference store.

**Why this priority**: The dual-store antipattern causes confusion, stale data, and the notification generation bug. Removing it is foundational to all other correctness fixes.

**Independent Test**: Remove `useStore.js` import of JSON data files and verify the application starts without errors, all pages load real API data, and no page references removed store actions.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** any page is visited, **Then** no data is sourced from `data/*.json` files at runtime.
2. **Given** `useStore.js` is refactored, **When** `MainLayout` uses dark mode, **Then** it reads from a minimal UI store with only `darkMode` and `toggleDarkMode`.
3. **Given** `App.jsx` is updated, **When** it mounts, **Then** no notification generation loop using `useStore`'s mock reservations/invoices/housekeeping runs.

---

### User Story 4 — Runtime Crash Guards on Date Parsing (Priority: P2)

Several pages crash when backend data contains null or missing date fields:
- `CheckInsPage` line 314: `format(parseISO(checkIn.expected_checkout_time))` throws when `expected_checkout_time` is null.
- `InvoicesPage` sort: `parseISO(a.issueDate).getTime()` returns NaN for null dates, breaking sort stability.
- `GuestProfilePage`: `GuestsPage` sort by `id` uses `Number(uuid)` which always returns NaN.

**Why this priority**: These are silent crashes that appear as blank pages or broken tables for real production data from the backend.

**Independent Test**: Create a check-in record with a null `expected_checkout_time`, navigate to Check-ins page and confirm the page renders safely showing a fallback value.

**Acceptance Scenarios**:

1. **Given** a check-in with `expected_checkout_time = null`, **When** the CheckIns list renders, **Then** the checkout column shows `—` or "Scheduled: N/A" without throwing.
2. **Given** invoices with null `issueDate`, **When** the table is sorted by date, **Then** the sort completes without NaN comparisons, placing null-date rows at the end.
3. **Given** guests are loaded from the API with UUID ids, **When** the guest list is sorted by ID, **Then** sorting falls back to alphabetical-by-name or creation order without NaN arithmetic.

---

### User Story 5 — `useMemo` Dependency Arrays Are Correct (Priority: P2)

Several `useMemo` hooks have incorrect dependency arrays, causing stale renders:
- `ReservationsPage.filteredAndSortedReservations` at line 237 is missing `sortOrder` from its dependency array — changing sort direction does not re-compute the sorted list.
- `DashboardPage.stats` at line 110 lists `reportStats` in its deps but `reportStats` is not used in that memo.

**Why this priority**: Stale memo results cause visible UI bugs where actions (toggling sort order) appear broken to users.

**Independent Test**: Open Reservations page, click a sort column twice to toggle direction — the list should reverse on the second click without a full page refresh.

**Acceptance Scenarios**:

1. **Given** reservations are displayed sorted by Check-in descending, **When** the user clicks the Check-in column header again, **Then** the list immediately re-sorts to ascending order.
2. **Given** `DashboardPage` loads, **When** `reportStats` changes, **Then** only memos that genuinely depend on it re-compute.

---

### User Story 6 — Hotel Switch Without Full Page Reload (Priority: P2)

`MainLayout` currently calls `window.location.reload()` when switching hotels. This clears all store state, interrupts any in-flight operations, and provides a jarring UX. Hotel switching should reset domain stores and re-fetch data for the new hotel without reloading the page.

**Why this priority**: Multi-property managers switch hotels frequently. A hard reload introduces latency and loses any unsaved UI state (open modals, filter selections).

**Independent Test**: Switch hotels while on the Reservations page — the page should update the reservation list for the new hotel without a full browser reload.

**Acceptance Scenarios**:

1. **Given** a user with access to two hotels is on the Reservations page, **When** they switch to the second hotel, **Then** the reservation list refreshes with the second hotel's data without a page reload.
2. **Given** a hotel switch occurs, **When** domain stores (reservations, guests, rooms) are reset, **Then** any currently displayed page re-fetches its data automatically.

---

### User Story 7 — Invoice PDF Download Is Accessible from UI (Priority: P2)

`api.js` has a `downloadPdf` method (`GET /v1/invoices/:id/pdf`) but no UI component calls it. UC-407 (Generate Invoice PDF) requires this. The Invoices page shows no download option.

**Why this priority**: Invoice PDF generation is a primary financial workflow deliverable listed as High priority in the use cases.

**Independent Test**: Open the Invoices page, click a "Download PDF" button on a paid invoice, confirm a PDF file is downloaded.

**Acceptance Scenarios**:

1. **Given** an invoice with status `Paid`, **When** the user clicks "Download PDF", **Then** the browser downloads the PDF file.
2. **Given** the PDF download fails, **When** the error is returned, **Then** a toast error message displays the reason.

---

### User Story 8 — RBAC-Aware UI: Role-Based Navigation Visibility (Priority: P3)

The backend enforces RBAC but the frontend shows all navigation and actions to all authenticated users. A `Viewer` should not see "Add Reservation" or "Delete" buttons. `Housekeeping Staff` should not see Invoices or Expenses. At minimum, destructive action buttons (Delete, Cancel, Clear Data) should be hidden based on the current user's role.

**Why this priority**: RBAC enforcement at the backend prevents data corruption but the cluttered UI confuses staff with inappropriate options. However, this is a UX/polish concern rather than a blocking operational bug.

**Independent Test**: Log in as a `VIEWER` role user; confirm the Reservations page shows no "Add Reservation" button and no "Cancel" or "Delete" actions.

**Acceptance Scenarios**:

1. **Given** a `VIEWER` role user, **When** any operational page loads, **Then** create/edit/delete action buttons are hidden.
2. **Given** a `HOUSEKEEPING` role user, **When** the sidebar renders, **Then** Invoices, Expenses, and Audit Logs navigation links are hidden.

---

### User Story 9 — Storybook Setup for Component Testing (Priority: P3)

The project has no Storybook configuration. The user explicitly requests Storybook for manual component testing. All reusable components (`Modal`, `StatusBadge`, `StatCard`, `GuestSelect`, `SearchInput`, `FilterSelect`, `ToastNotification`, `ConfirmationDialog`, `CheckInModal`) need stories.

**Why this priority**: Storybook enables isolated visual testing of UI components, critical for verifying the fixes in stories 1–8 without running the full backend stack.

**Independent Test**: Run `npm run storybook`, navigate to the `StatusBadge` story, and verify all statuses render correctly with correct colors.

**Acceptance Scenarios**:

1. **Given** Storybook is installed, **When** `npm run storybook` is executed, **Then** the Storybook UI loads at `http://localhost:6006`.
2. **Given** a `Modal` story exists, **When** it is rendered in Storybook, **Then** the modal opens and closes correctly without a router or store dependency.
3. **Given** a `CheckInModal` story exists, **When** rendered with a mock reservation prop, **Then** the full check-in flow renders visually.

---

### User Story 10 — Notifications Polling (Priority: P3)

The `Notifications` component fetches on mount and dropdown open, but never polls. After the initial load, staff miss new alerts unless they manually open and close the dropdown.

**Why this priority**: Real-time notification awareness is specified in the use cases (UC-1103, UC-1104, UC-1105) and is important for operational responsiveness.

**Independent Test**: Trigger a server-side notification (e.g., create a maintenance request), wait 30 seconds without opening the notifications dropdown, and verify the unread count badge updates automatically.

**Acceptance Scenarios**:

1. **Given** the user is on any page, **When** a new server notification is created, **Then** the bell badge count increments within 30 seconds.
2. **Given** the polling interval elapses while the dropdown is open, **Then** the list refreshes in place without closing the dropdown.

---

### Edge Cases

- What happens when a reservation's `checkIn` or `checkOut` date string is malformed? The `parseISO` calls should be wrapped in try-catch with fallback rendering.
- How does the app behave when `activeHotelId` is null and an API call requires hotel context? The `PROPERTY_CONTEXT_REQUIRED` error code is handled in `api.js` with a user-friendly message, but the UI should prevent the call from being made.
- What happens if a user navigates directly to `/guests/:id` where the guest isn't in the local store (e.g., fresh page load)? `GuestProfilePage` shows "Guest not found" — it should attempt a `fetchGuest(id)` API call instead.
- What happens if `window.location.reload()` is removed from hotel switch but a domain store `fetchX()` fails for the new hotel? Each store should reset to empty state on hotel switch failure rather than showing stale data.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST remove all runtime imports of `data/*.json` from store/component files and serve all entity data exclusively from API calls.
- **FR-002**: `App.jsx` MUST NOT generate local notifications from store data; server-side notifications via `GET /v1/notifications` are the only source.
- **FR-003**: `useStore.js` MUST be refactored to retain only UI preference state (`darkMode`); all domain state must be removed.
- **FR-004**: The Reservations page MUST provide a "Cancel" action for reservations with status `Confirmed`, `Checked-in` (per use case rules), or `No-show`.
- **FR-005**: The Reservations page MUST provide an "Edit" action to modify check-in/check-out dates for reservations not yet checked out.
- **FR-006**: `filteredAndSortedReservations` useMemo in `ReservationsPage` MUST include `sortOrder` in its dependency array.
- **FR-007**: `CheckInsPage` MUST guard against null `expected_checkout_time` before passing it to `format(parseISO(...))`.
- **FR-008**: `InvoicesPage` sort MUST handle null/undefined `issueDate` and `dueDate` without producing NaN comparisons.
- **FR-009**: `GuestsPage` sort by ID MUST use a UUID-compatible comparison (e.g., lexicographic) instead of `Number(id)`.
- **FR-010**: Hotel switching in `MainLayout` MUST reset domain stores and re-fetch data without calling `window.location.reload()`.
- **FR-011**: The Invoices page MUST show a "Download PDF" button that triggers `api.invoices.downloadPdf(id)` and downloads the file.
- **FR-012**: `GuestProfilePage` MUST call `fetchGuest(id)` when the guest is not found in local store state (direct navigation / page refresh).
- **FR-013**: Storybook MUST be installed and configured with stories for: `Modal`, `StatusBadge`, `StatCard`, `SearchInput`, `FilterSelect`, `ToastNotification`, `ConfirmationDialog`, `GuestSelect`, `CheckInModal`.
- **FR-014**: `Notifications` component MUST poll the server at a configurable interval (default 30 seconds) to refresh the notification list.
- **FR-015**: The dashboard "Cancellation Rate" chart MUST NOT use fabricated historical data (`rate * 1.1`); use real data or remove the "Last Month" bar until historical data is available from the backend.
- **FR-016**: Dark mode classes MUST be consistently applied on `CheckInsPage` stats cards and all pages that currently lack `dark:` Tailwind variants.
- **FR-017**: The Reservations page room-unit availability check MUST NOT perform N+1 API calls per room; use the existing room-type availability endpoint result.
- **FR-018**: Navigation items in `MainLayout` MUST be filtered by user role (at minimum, destructive actions hidden from `VIEWER` and `HOUSEKEEPING` roles).

### Traceability & Constraints

- FR-001 through FR-003 address the dual-store antipattern; changes touch `App.jsx`, `useStore.js`, `MainLayout.jsx` — all three files must be updated together.
- FR-004, FR-005 add API calls to `reservationsStore.updateReservation`; no schema change required (backend already supports status updates).
- FR-011 requires no new backend endpoint; `GET /v1/invoices/:id/pdf` exists.
- FR-013 (Storybook) adds new devDependency (`@storybook/react-vite`) but does not change production build.
- FR-018 (RBAC UI): reads `user.role` from `authStore`; no backend change required.
- Security: FR-002 ensures notifications are user/role-scoped via server; removing client-side generation eliminates the risk of showing cross-user notifications based on cached data.
- Audit: No new audit log entries required for frontend-only fixes.

### Key Entities

- **Notification**: Server-persisted record with `type`, `title`, `body`, `read`, `created_at`, `payload.link`; fetched via `GET /v1/notifications`.
- **Reservation**: Domain entity fetched from API; has `status` (Confirmed, Checked-in, Checked-out, Cancelled, No-show), `checkIn`, `checkOut`, `guestId`, `roomTypeId`.
- **UI Preference Store**: Minimal Zustand store retaining only `darkMode` boolean and `toggleDarkMode` action after `useStore` refactor.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 9 identified runtime crash scenarios (null date parsing, NaN sort, phantom notifications) are eliminated; the application renders without unhandled exceptions on any real backend data.
- **SC-002**: Front desk staff can cancel a reservation from the Reservations page in under 3 clicks.
- **SC-003**: Hotel switch completes and the target page re-renders with correct hotel data within 2 seconds without a browser reload.
- **SC-004**: Storybook launches successfully and displays at least 9 component stories; each story renders in isolation without requiring a backend connection.
- **SC-005**: The notification badge count updates within 30 seconds of a new server notification being created, without user interaction.
- **SC-006**: The `data/*.json` files are no longer imported by any component or store at runtime (verifiable by grepping `import.*data/` from `src/`).
- **SC-007**: Sort direction toggling on the Reservations and Invoices pages is visually immediate (no stale render after a single click).

---

## Assumptions

- The backend API for all existing endpoints (`/v1/reservations`, `/v1/notifications`, `/v1/invoices/:id/pdf`, etc.) is functional and deployed.
- The `user.role` field is available on the `authStore.user` object as returned by `GET /auth/me`.
- Storybook `@storybook/react-vite` v8+ is compatible with the existing Vite 5 + React 18 setup.
- The `data/*.json` mock files may be kept in the repository as development fixtures but must not be imported at runtime.
- Password reset UI (forgot-password page) is out of scope for this feature — the API methods exist but a dedicated reset-password route/page is deferred to a separate feature.
- Pagination for large datasets (guests, reservations, audit logs) is considered a separate feature; this audit focuses on correctness and quality, not scale.
- The `useStore` refactor will retain `darkMode` only; if any component not yet identified also reads from `useStore`, it will be migrated to the appropriate domain store as part of implementation.
