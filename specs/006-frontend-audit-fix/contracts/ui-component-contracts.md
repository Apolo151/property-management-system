# UI Component Contracts

**Feature**: 006-frontend-audit-fix  
**Phase**: 1 — Design  
**Date**: 2026-04-15

These contracts define the stable public interface of each reusable component. Any change to these props is a breaking change and must be coordinated with all consumers.

---

## `StatusBadge`

**File**: `src/components/StatusBadge.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `string` | ✓ | Display value; determines color and label |
| `type` | `'reservation' \| 'room' \| 'maintenance' \| 'invoice' \| 'checkin'` | ✗ | Optional category hint for color mapping |

### Status → Color Mapping (invariant)
| Status | Color |
|--------|-------|
| `Confirmed` | blue |
| `Checked-in` / `Checked In` | green |
| `Checked-out` / `Checked Out` | gray |
| `Cancelled` | red |
| `No-show` | amber |
| `Available` | green |
| `Occupied` | red |
| `Cleaning` | yellow |
| `Out of Service` | gray |
| `Paid` | green |
| `Pending` | yellow |
| `Open` | blue |
| `In Progress` | yellow |
| `Repaired` | green |

---

## `Modal`

**File**: `src/components/Modal.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✓ | Controls visibility |
| `onClose` | `() => void` | ✓ | Called on backdrop click or close button |
| `title` | `string` | ✓ | Modal header title |
| `children` | `ReactNode` | ✓ | Modal body content |

### Behaviour
- Traps focus when open (accessibility requirement).
- Pressing `Escape` calls `onClose`.
- Renders a portal to `document.body`.

---

## `SearchInput`

**File**: `src/components/SearchInput.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✓ | Controlled input value |
| `onChange` | `(value: string) => void` | ✓ | Called on every keystroke |
| `placeholder` | `string` | ✗ | Input placeholder |
| `label` | `string` | ✗ | Label above input |

---

## `FilterSelect`

**File**: `src/components/FilterSelect.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✓ | Selected value |
| `onChange` | `(value: string) => void` | ✓ | Called on selection change |
| `options` | `Array<{ value: string, label: string }>` | ✓ | Dropdown options |
| `placeholder` | `string` | ✗ | Empty/default option label |
| `label` | `string` | ✗ | Label above select |

---

## `StatCard`

**File**: `src/components/StatCard.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✓ | Card label |
| `value` | `string \| number` | ✓ | Main displayed value |
| `icon` | `ReactNode` | ✗ | Icon displayed left of value |
| `className` | `string` | ✗ | Additional CSS classes |

---

## `GuestSelect`

**File**: `src/components/GuestSelect.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✓ | Selected guest ID |
| `onChange` | `(guestId: string) => void` | ✓ | Called when guest selected |
| `guests` | `Guest[]` | ✓ | List of available guests |
| `label` | `string` | ✗ | Field label |
| `placeholder` | `string` | ✗ | Search input placeholder |
| `required` | `boolean` | ✗ | Whether selection is required |
| `onCreateGuest` | `(data: GuestData) => Promise<void>` | ✗ | Handler to create new guest inline |
| `guestName` | `string` | ✗ | New guest name field value |
| `onGuestNameChange` | `(name: string) => void` | ✗ | Called when new guest name changes |

---

## `CheckInModal`

**File**: `src/components/CheckInModal.jsx`

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | ✓ | Controls visibility |
| `onClose` | `() => void` | ✓ | Called after successful check-in or cancel |
| `reservation` | `Reservation \| null` | ✓ | Reservation to check in |

### Behaviour
- Fetches eligible rooms via `GET /v1/reservations/:id/eligible-rooms` when opened.
- Calls `POST /v1/reservations/:id/check-in` on confirm.
- Calls `onClose()` after success to allow parent to refresh data.

---

## `ToastNotification` / `ToastContainer`

**File**: `src/components/ToastNotification.jsx`, `src/components/ToastContainer.jsx`

### Toast Shape (consumed from `toastStore`)
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID |
| `type` | `'success' \| 'error' \| 'warning' \| 'info'` | Visual style |
| `message` | `string` | Displayed text |

### `useToast` Hook API
```
const toast = useToast();
toast.success(message)
toast.error(message)
toast.warning(message)
toast.info(message)
```

---

## `ConfirmationDialog`

**File**: `src/components/ConfirmationDialog.jsx`

### `useConfirmation` Hook API
```
const confirmation = useConfirmation();
const confirmed = await confirmation({
  title: string,
  message: string,
  variant: 'default' | 'warning' | 'danger'
});
// confirmed: boolean
```

### Behaviour
- Renders as a portal modal.
- Returns a `Promise<boolean>` that resolves when user confirms or cancels.
- Resolves `true` on confirm, `false` on cancel or backdrop click.

---

## New: `usePolling` Hook

**File**: `src/hooks/usePolling.js`

```js
usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled?: boolean = true
): void
```

### Invariants
- Does NOT start a timer when `enabled === false`.
- Clears timer on unmount.
- Always calls **latest** version of `callback` (ref-stabilized).

---

## New: `usePermissions` Hook

**File**: `src/hooks/usePermissions.js`

```js
const {
  canCreate,
  canEdit,
  canDelete,
  canViewFinancials,
  canManageUsers,
  canViewAuditLogs,
  canManageSettings
} = usePermissions();
```

### Invariants
- All flags default to `false` when `user` is null.
- Reads from `useAuthStore().user.role` synchronously.
- Does NOT make API calls.

---

## API Contracts (Frontend → Backend, affected by this feature)

| Action | Method | Endpoint | Notes |
|--------|--------|----------|-------|
| Cancel reservation | `PUT` | `/v1/reservations/:id` | Body: `{ status: 'Cancelled' }` |
| Edit reservation dates | `PUT` | `/v1/reservations/:id` | Body: `{ check_in, check_out }` |
| Download invoice PDF | `GET` | `/v1/invoices/:id/pdf` | Returns `Blob` (application/pdf) |
| List notifications | `GET` | `/v1/notifications?limit=50` | Returns `{ notifications: [...] }` |
| Mark notification read | `PATCH` | `/v1/notifications/:id/read` | No body |
| Mark all read | `POST` | `/v1/notifications/read-all` | No body |

All endpoints already exist on the backend; no new routes required.
