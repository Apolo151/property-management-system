# Data Model: Frontend Audit & Comprehensive Fix

**Feature**: 006-frontend-audit-fix  
**Phase**: 1 — Design  
**Date**: 2026-04-15

> This feature is **purely frontend**. No database schema changes. No new backend migrations.  
> This document captures: refactored store shapes, new utility types, and state transition rules.

---

## 1. Refactored `useStore` (UI Preferences Only)

**Before** (anti-pattern — full domain data + mock JSON):
```
useStore = {
  rooms, guests, reservations, invoices, housekeeping,
  maintenanceRequests, expenses, auditLogs, notifications,
  darkMode, ... actions
}
```

**After** (minimal UI preference store):
```
useStore = {
  darkMode: boolean,
  toggleDarkMode: () => void
}
```

**Validation rules**:
- `darkMode` is persisted in `localStorage('darkMode')` — no backend dependency.
- All domain data is owned exclusively by domain stores.

---

## 2. Domain Store Registry

### `storeRegistry.js` (new file)

```
storeRegistry = {
  resetFns: Set<() => void>,
  registerDomainReset: (fn: () => void) => void,
  resetAllDomainStores: () => void
}
```

**Behaviour**: calling `resetAllDomainStores()` invokes all registered `reset()` functions. Each domain store registers its own reset during module initialization.

---

## 3. Updated Domain Stores — Added `reset()` Action

Each of the following stores gains a `reset()` action and registers with the registry:

| Store | `initialState` fields |
|-------|-----------------------|
| `reservationsStore` | `{ reservations: [], loading: false, error: null }` |
| `guestsStore` | `{ guests: [], loading: false, error: null }` |
| `roomsStore` | `{ rooms: [], housekeeping: [], isLoading: false, error: null }` |
| `roomTypesStore` | `{ roomTypes: [], loading: false, error: null }` |
| `checkInsStore` | `{ checkIns: [], activeCheckIns: [], currentCheckIn: null, loading: false, error: null, filters: {...} }` |
| `invoicesStore` | `{ invoices: [], loading: false, error: null }` |
| `expensesStore` | `{ expenses: [], loading: false, error: null }` |
| `maintenanceStore` | `{ maintenanceRequests: [], loading: false, error: null }` |
| `roomTypesStore` | `{ roomTypes: [], loading: false, error: null }` |
| `auditLogsStore` | `{ auditLogs: [], loading: false, error: null }` |

**State transition on hotel switch**:
```
HOTEL_SWITCH_TRIGGERED
  → authStore.activeHotelId = newId (localStorage updated)
  → resetAllDomainStores() [all stores → initial state]
  → components with useEffect([activeHotelId]) re-fetch
  → UI re-renders with new hotel's data
```

---

## 4. `usePermissions` Hook

**Source**: `useAuthStore().user.role`

**Shape** (returned from `usePermissions()`):
```
{
  canCreate: boolean,       // create reservations, guests, rooms, etc.
  canEdit: boolean,         // edit reservations, rooms, guests
  canDelete: boolean,       // delete/cancel resources
  canViewFinancials: boolean, // invoices, expenses, reports
  canManageUsers: boolean,  // staff/users management
  canViewAuditLogs: boolean, // audit logs access
  canManageSettings: boolean // hotel settings, channel manager
}
```

**Role → Permission Matrix**:

| Role | create | edit | delete | financials | manageUsers | auditLogs | settings |
|------|--------|------|--------|------------|-------------|-----------|----------|
| `SUPER_ADMIN` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ADMIN` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `MANAGER` | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ |
| `FRONT_DESK` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `HOUSEKEEPING` | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `MAINTENANCE` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `VIEWER` | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |

**Default when `user.role` is null/undefined**: all `false` (most restrictive — fail safe).

---

## 5. `usePolling` Hook

**File**: `src/hooks/usePolling.js`

```
usePolling(callback: () => void, intervalMs: number, enabled: boolean) → void
```

**Internal state**:
- `savedCallback: Ref<() => void>` — always points to latest callback; updated every render.
- Interval timer: only created when `enabled === true`.
- Cleanup: `clearInterval` on unmount or when `enabled` changes to false.

**Constraints**:
- Must NOT fire when `document.visibilityState === 'hidden'`.
- Must NOT start multiple concurrent intervals.
- Caller (Notifications component) owns the `inFlight` guard to prevent concurrent API calls.

---

## 6. `safeFormat` Date Utility

**File**: `src/utils/dateUtils.js` (new utility, or inline)

```
safeFormat(dateStr: string | null | undefined, fmt: string, fallback?: string) → string
```

**Behaviour**:
- Returns `fallback` (default `'—'`) when `dateStr` is null, undefined, or empty.
- Wraps `format(parseISO(dateStr), fmt)` in a try-catch; returns `fallback` on parse error.

**Used in**:
- `CheckInsPage` — `expected_checkout_time`, `check_in_time`, `actual_checkout_time`
- `InvoicesPage` — sort comparison guard (returns `0` when either date is null)
- `Notifications` — notification `timestamp`

---

## 7. Reservation Status State Machine

No changes to backend state machine. Frontend actions added:

```
Confirmed  ──[Cancel]──→  Cancelled
Confirmed  ──[Edit Dates]──→ Confirmed (dates updated)
Confirmed  ──[Check In]──→  (creates check_in record → reservation.status = Checked-in)
Confirmed  ──[No-show]──→  No-show
Checked-in ──[Check Out]─→ (via CheckInsPage checkout)
```

**Frontend action visibility** (by status):

| Status | Cancel | Edit Dates | Check In | No-show | Create Invoice |
|--------|--------|------------|----------|---------|----------------|
| Confirmed | ✓ | ✓ | ✓ | ✓ | ✓ |
| Checked-in | ✗ | ✗ | ✗ | ✗ | ✓ |
| Checked-out | ✗ | ✗ | ✗ | ✗ | ✓ |
| Cancelled | ✗ | ✗ | ✗ | ✗ | ✗ |
| No-show | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 8. Storybook Story Shapes

Each component story has a defined `args` interface:

### `StatusBadge`
```
args: { status: string, type?: 'reservation' | 'room' | 'maintenance' | 'invoice' }
```

### `StatCard`
```
args: { title: string, value: string | number, icon?: ReactNode, className?: string }
```

### `Modal`
```
args: { isOpen: boolean, onClose: () => void, title: string, children: ReactNode }
```

### `SearchInput`
```
args: { value: string, onChange: (val: string) => void, placeholder?: string, label?: string }
```

### `FilterSelect`
```
args: { value: string, onChange: (val: string) => void, options: Array<{value, label}>, placeholder?: string, label?: string }
```

### `ToastNotification`
```
args: { type: 'success' | 'error' | 'warning' | 'info', message: string, onClose: () => void }
```

### `ConfirmationDialog`
```
store state: { isOpen: boolean, title: string, message: string, variant: string, onConfirm, onCancel }
```
Story seeds the `confirmationStore` state directly.

### `GuestSelect`
```
args: { value: string, onChange, guests: Guest[], label?: string, onCreateGuest?, required? }
```

### `CheckInModal`
```
args: { isOpen: boolean, onClose: () => void, reservation: Reservation }
```
Story injects a mock reservation object.
