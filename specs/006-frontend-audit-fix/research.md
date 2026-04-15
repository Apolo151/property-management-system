# Research: Frontend Audit & Comprehensive Fix

**Feature**: 006-frontend-audit-fix  
**Phase**: 0 — Research  
**Date**: 2026-04-15

---

## Decision 1: Storybook Setup for React 18 + Vite 5

### Decision
Use **`@storybook/react-vite` v8.x** with **`@storybook/addon-essentials`**. Pin all `@storybook/*` packages to the same `^8.6.x` line to avoid Storybook 9 incompatibilities.

### Required `devDependencies` (frontend)
```
storybook@^8.6.18
@storybook/react-vite@^8.6.18
@storybook/addon-essentials@^8.6.18
@storybook/addon-interactions@^8.6.18
```

### `.storybook/main.js` (minimal, Vite + Tailwind)
```js
const config = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/react-vite', options: {} },
};
export default config;
```

### `.storybook/preview.js`
```js
import '../src/index.css'; // loads Tailwind
export const parameters = { actions: { argTypesRegex: '^on[A-Z].*' } };
```

### Handling `react-router-dom` in stories
Wrap stories that use `useNavigate`/`useLocation` with a `MemoryRouter` decorator:
```jsx
import { MemoryRouter } from 'react-router-dom';
const withRouter = (Story) => <MemoryRouter><Story /></MemoryRouter>;
export const decorators = [withRouter]; // in preview.js for global, or per-story
```

### Handling Zustand stores in stories
Use `useState.setState(overrides)` in a decorator or directly in the story's `render` to seed store state:
```jsx
import useAuthStore from '../store/authStore';
// In decorator:
useAuthStore.setState({ user: { role: 'ADMIN', name: 'Test User' }, isAuthenticated: true });
```
No module mocking needed for most UI stories; state seeding is cleaner and doesn't break imports.

### Rationale
- `@storybook/react-vite` is the correct Storybook 8 framework package for Vite-based React projects (no separate "vite-5" package exists).
- CSF3 format (named export objects with `args`) is the current recommended standard.
- Adding `storybook` script to `frontend/package.json`: `"storybook": "storybook dev -p 6006"`.
- Tailwind applies automatically once `src/index.css` is imported in preview.

### Alternatives Considered
- **Storybook 9**: Avoided — may require different config; v8 is stable on Vite 5 + React 18.
- **Chromatic**: Optional addon for visual regression; out of scope for this feature.

---

## Decision 2: Zustand Store Reset on Hotel Switch (No `window.location.reload()`)

### Decision
Implement a **domain store registry** pattern with `reset()` on each domain store that calls `setState(getInitialState(), true)`. On hotel switch: update `activeHotelId` in `authStore` → call `resetAllDomainStores()` → components with `useEffect([hotelId])` re-fetch automatically.

### Store Reset Pattern
Each domain store exposes a `reset()` action:
```js
// e.g. reservationsStore.js
const useReservationsStore = create((set, get, api) => ({
  reservations: [],
  loading: false,
  error: null,
  reset: () => set(api.getInitialState(), true),
  // ... other actions
}));

// Register globally
import { registerDomainReset } from './storeRegistry';
registerDomainReset(() => useReservationsStore.getState().reset());
```

### Registry (`storeRegistry.js`)
```js
const resetFns = new Set();
export function registerDomainReset(fn) { resetFns.add(fn); }
export function resetAllDomainStores() { resetFns.forEach(fn => fn()); }
```

### Hotel Switch Handler (in `authStore.switchHotel`)
```js
switchHotel: (hotelId) => {
  const { hotels } = get();
  const hotel = hotels.find(h => h.id === hotelId);
  if (!hotel) return false;
  localStorage.setItem('activeHotelId', hotelId);
  set({ activeHotelId: hotelId });
  resetAllDomainStores();    // clears all cached data
  return true;
},
```

### Component Re-fetch Pattern
Pages that load data on mount should include `activeHotelId` in `useEffect` deps:
```js
const { activeHotelId } = useAuthStore();
useEffect(() => {
  fetchReservations();
}, [fetchReservations, activeHotelId]);
```

### Rationale
- `getInitialState()` is the idiomatic Zustand v5 mechanism for resetting to initial state.
- Registry pattern avoids spreading hotel-switch logic across every store file.
- No `window.location.reload()` needed; component effects handle re-fetch on `hotelId` change.

### Alternatives Considered
- **TanStack Query with `hotelId` in query key**: More powerful but adds a new dependency; out of scope for this minimal-change audit.
- **`key={hotelId}` on layout**: Remounts entire React tree; wasteful and causes flickering.
- **Event emitter (EventEmitter3)**: More flexible but adds dependency; registry is simpler.

---

## Decision 3: Notification Polling Pattern

### Decision
Use a **`usePolling` custom hook** with a ref-stabilized callback, `visibilityState` gating, and an `inFlight` ref guard. Poll at **30-second fixed interval**.

### `usePolling` Hook Implementation
```js
// src/hooks/usePolling.js
import { useEffect, useRef } from 'react';

export function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => { savedCallback.current(); }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
```

### Usage in `Notifications.jsx`
```js
const inFlight = useRef(false);
const poll = useCallback(async () => {
  if (inFlight.current || !localStorage.getItem('token')) return;
  inFlight.current = true;
  try { await load(); } finally { inFlight.current = false; }
}, [load]);

const [visible, setVisible] = useState(document.visibilityState === 'visible');
useEffect(() => {
  const handler = () => setVisible(document.visibilityState === 'visible');
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, []);

usePolling(poll, 30_000, visible);
```

### Rationale
- Ref-stabilized callback prevents stale closures without interval recreation.
- `visibilityState` gating avoids background network calls when user is on another tab.
- `inFlight` guard prevents concurrent fetches under slow network.
- 30s fixed interval is appropriate for hotel notification use case.

### Alternatives Considered
- **`setTimeout` recursion (30s after success)**: Better for cases where response time is variable; overkill here.
- **WebSocket / SSE**: Preferred long-term for true real-time; out of scope for this minimal audit fix.
- **`useSyncExternalStore` for visibility**: More correct in concurrent mode; `useState` + event listener is sufficient here.

---

## Decision 4: Dual-Store Elimination Strategy

### Decision
Refactor `useStore.js` to retain **only** `darkMode` + `toggleDarkMode`. Remove all domain data (guests, rooms, reservations, invoices, housekeeping, maintenanceRequests, expenses, auditLogs, notifications). Remove the `App.jsx` notification generation loop entirely. Remove JSON data file imports from `useStore.js`.

### Files to Update
| File | Change |
|------|--------|
| `useStore.js` | Keep only `{ darkMode, toggleDarkMode }` |
| `App.jsx` | Remove `useStore()` call; remove notification generation `useEffect` |
| All stores | Add `reset()` action + register in `storeRegistry` |
| `MainLayout.jsx` | Replace `window.location.reload()` with `switchHotel` + store reset |

### Data files
`src/data/*.json` files remain on disk (useful as dev fixtures / reference) but are not imported by any runtime file after this change.

### Rationale
The dual-store antipattern is the root cause of: phantom notifications, stale data rendering, and confusion about source of truth. Eliminating it makes the data flow unambiguous: all entity data comes from the API.

---

## Decision 5: RBAC-Aware UI Approach

### Decision
Read `user.role` from `useAuthStore().user.role`. Create a `usePermissions()` hook that returns boolean flags (`canCreate`, `canEdit`, `canDelete`, `canViewFinancials`) derived from role. Hide action buttons conditionally.

### Role Mapping
| Role | canCreate | canEdit | canDelete | canViewFinancials |
|------|-----------|---------|-----------|-------------------|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ | ✓ | ✗ | ✓ |
| FRONT_DESK | ✓ | ✓ (limited) | ✗ | ✗ |
| HOUSEKEEPING | ✗ | ✓ (own tasks) | ✗ | ✗ |
| MAINTENANCE | ✓ (requests) | ✓ (own) | ✗ | ✗ |
| VIEWER | ✗ | ✗ | ✗ | ✓ |

### Rationale
Centralizing permission logic in a hook avoids scattering `user.role === 'ADMIN'` checks across every page. Role names match the backend `auth_types.ts` definitions.

---

## Decision 6: Cancel + Edit Reservation Implementation

### Decision
Add two actions to `ReservationsPage`:
1. **Cancel**: calls `updateReservation(id, { status: 'Cancelled' })` — existing endpoint `PUT /v1/reservations/:id`.
2. **Edit Dates**: opens a small inline modal to pick new check-in/check-out, validates availability, then calls `updateReservation(id, { checkIn, checkOut })`.

### Shown For Statuses
- Cancel: shown for `Confirmed` and `No-show` (not already-cancelled or checked-out).
- Edit Dates: shown for `Confirmed` only.

### Rationale
The backend already supports `PUT /v1/reservations/:id` with `status` and date fields. No new endpoints required.

---

## Decision 7: Invoice PDF Download Button

### Decision
Add a "Download PDF" button to the Invoices table. On click, calls `api.invoices.downloadPdf(id)` which returns a `Blob`, then creates an object URL and triggers browser download.

```js
const blob = await api.invoices.downloadPdf(invoice.id);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `invoice-${invoice.id.substring(0, 8)}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

### Rationale
`api.js` already implements `downloadPdf`. This is purely a UI wiring task with no new backend work.

---

## Decision 8: Runtime Crash Guards

### Decision
All `parseISO()` calls on potentially-null/undefined date strings MUST be wrapped with a null-check:
```js
// Pattern:
const safeFormat = (dateStr, fmt, fallback = '—') => {
  if (!dateStr) return fallback;
  try { return format(parseISO(dateStr), fmt); } catch { return fallback; }
};
```
Guest ID sort: replace `Number(id)` with `String(a.id).localeCompare(String(b.id))`.

---

## Summary of All Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Storybook | `@storybook/react-vite` v8.x, CSF3, MemoryRouter decorator |
| 2 | Store reset | `reset()` per store + registry + `useEffect([hotelId])` re-fetch |
| 3 | Notifications polling | `usePolling` hook, 30s, visibilityState gated |
| 4 | Dual-store elimination | `useStore.js` → darkMode only; remove JSON imports |
| 5 | RBAC UI | `usePermissions()` hook from `user.role` |
| 6 | Cancel/Edit reservation | `updateReservation` with status/dates via existing endpoint |
| 7 | Invoice PDF | Blob download wiring to existing API method |
| 8 | Crash guards | `safeFormat` helper; replace `Number(uuid)` with `localeCompare` |
