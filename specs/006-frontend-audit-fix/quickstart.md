# Quickstart: Frontend Audit & Comprehensive Fix

**Feature**: 006-frontend-audit-fix  
**Date**: 2026-04-15

---

## Prerequisites

- Node.js 18+
- Backend running on `localhost:3000` (see `backend/README.md`)
- `frontend/.env` or Vite's `VITE_API_URL` pointing to backend

---

## Development Setup

```bash
# 1. Switch to feature branch
git checkout 006-frontend-audit-fix

# 2. Install frontend dependencies (including new Storybook devDeps)
cd frontend
npm install

# 3. Start the dev server
npm run dev
# → http://localhost:5173
```

---

## Running Storybook (Component Testing)

After Storybook is installed as part of this feature:

```bash
cd frontend
npm run storybook
# → http://localhost:6006
```

All components will be visible under their respective story categories. Stories do not require a backend connection.

### Storybook Structure
```
frontend/src/
├── components/
│   ├── StatusBadge.stories.jsx
│   ├── StatCard.stories.jsx
│   ├── Modal.stories.jsx
│   ├── SearchInput.stories.jsx
│   ├── FilterSelect.stories.jsx
│   ├── ToastNotification.stories.jsx
│   ├── ConfirmationDialog.stories.jsx
│   ├── GuestSelect.stories.jsx
│   └── CheckInModal.stories.jsx
└── .storybook/
    ├── main.js
    └── preview.js
```

---

## What Was Fixed (Summary)

### Bugs Fixed
| # | File | Fix |
|---|------|-----|
| 1 | `App.jsx` | Removed client-side notification generation loop |
| 2 | `useStore.js` | Reduced to `{ darkMode, toggleDarkMode }` only |
| 3 | `CheckInsPage.jsx` | Added null guard on `expected_checkout_time` |
| 4 | `InvoicesPage.jsx` | Added null guard in date sort comparator |
| 5 | `GuestsPage.jsx` | Fixed UUID sort (`localeCompare` vs `Number()`) |
| 6 | `ReservationsPage.jsx` | Added `sortOrder` to `useMemo` deps |
| 7 | `ReservationsPage.jsx` | Removed N+1 room availability loop |
| 8 | `DashboardPage.jsx` | Removed fabricated `rate * 1.1` cancellation chart |
| 9 | `MainLayout.jsx` | Replaced `window.location.reload()` with store reset |
| 10 | `GuestProfilePage.jsx` | Added `fetchGuest(id)` on not-found fallback |

### Features Added
| # | Feature | File(s) |
|---|---------|---------|
| 11 | Cancel Reservation | `ReservationsPage.jsx` |
| 12 | Edit Reservation Dates | `ReservationsPage.jsx` |
| 13 | Invoice PDF Download | `InvoicesPage.jsx` |
| 14 | Notification Polling (30s) | `Notifications.jsx`, `hooks/usePolling.js` |
| 15 | RBAC-aware action buttons | `hooks/usePermissions.js`, all pages |
| 16 | Storybook (9 component stories) | `*.stories.jsx`, `.storybook/` |
| 17 | Store reset registry | `store/storeRegistry.js`, all domain stores |
| 18 | Dark mode on CheckInsPage stats | `CheckInsPage.jsx` |

---

## Verifying the Key Fixes

### 1. No phantom notifications
```
1. Log in as any user
2. Open notification bell
3. Verify: only server-persisted notifications appear
4. Verify: no duplicates or stale entries from JSON mock data
```

### 2. Cancel Reservation
```
1. Go to /reservations
2. Find a Confirmed reservation
3. Click Cancel → confirm dialog
4. Verify: status badge updates to Cancelled
5. Verify: Check In and No-show buttons disappear
```

### 3. Hotel Switch Without Reload
```
1. Log in as a Super Admin with 2+ hotels
2. Navigate to /reservations (note reservation count)
3. Switch hotel using the sidebar switcher
4. Verify: reservation list updates without browser reload
5. Verify: URL does not change
```

### 4. Notification Polling
```
1. Open the app and leave the bell dropdown closed
2. Use the backend to create a notification (or trigger a check-in)
3. Wait 30 seconds
4. Verify: unread badge count increments without any user interaction
```

### 5. Storybook — StatusBadge
```
npm run storybook
→ Navigate to: Components/StatusBadge
→ Verify all status variants render with correct colors
→ Switch to "All Statuses" story and verify each badge
```

### 6. Invoice PDF
```
1. Go to /invoices
2. Find a Paid invoice
3. Click "Download PDF"
4. Verify: PDF file downloads in the browser
```

---

## Environment Variables

```env
# frontend/.env (or .env.local)
VITE_API_URL=http://localhost:3000/api
```

No new environment variables required for this feature.

---

## Running All Frontend Checks

```bash
cd frontend

# Lint (if configured)
npm run lint

# Build to verify no compile errors
npm run build

# Storybook build (visual regression check)
npm run build-storybook
```
