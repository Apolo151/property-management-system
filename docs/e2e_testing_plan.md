# Hotel PMS — End-to-End Testing Plan

> Based on [USE_CASES.md](file:///home/abdallah/Projects/freelance/hotelmanangement/docs/USE_CASES.md), [gap report](file:///home/abdallah/Projects/freelance/hotelmanangement/docs/PMS_USE_CASE_QLOAPPS_GAP_REPORT.md), and full codebase review (2026-04-16).

---

## 1. Executive Summary

This plan covers **all 12 modules and 80+ use cases** from USE_CASES.md across **backend API** (automated) and **frontend UI** (manual + browser agent) testing. Every test maps to a specific use case ID and includes exact execution steps.

### Current Test Coverage

| Layer | Existing | Files |
|---|---|---|
| Backend E2E (vitest+supertest) | **11 files, ~85 test cases** | `auth`, `guests`, `rooms`, `reservations`, `check_ins`, `invoices`, `expenses`, `maintenance`, `reports`, `audit`, `notifications` |
| Backend unit tests | **7 files** | `audit_rbac`, `audit_tenancy`, `expenses_rbac`, `maintenance_tenancy`, `check_ins_service` (skipped), `hotel_date`, `users_auth` |
| Frontend tests | **0 files** | No test infrastructure (vitest deps not installed) |
| Browser/UI E2E | **0** | No Playwright/Cypress/browser tests |

### Coverage Gaps Identified

| Gap Area | Missing Tests | Priority |
|---|---|---|
| Room Types CRUD | No `room_types_e2e.test.ts` | P0 |
| Hotels / Settings CRUD | No `hotels_e2e.test.ts` or `settings_e2e.test.ts` | P1 |
| QloApps integration | No integration tests (requires QloApps instance) | P2 |
| Frontend UI flows | No automated or scripted UI tests | P0 |
| Cross-module lifecycle | Scattered across files; no dedicated lifecycle suite | P1 |

---

## 2. Test Environment Setup

### Prerequisites

```bash
# From repo root — start all services
cp .env.example .env
docker compose up -d
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
```

### Test Users (from seed data)

| Role | Email | Password |
|---|---|---|
| SUPER_ADMIN | admin@hotel.com | admin123 |
| MANAGER | manager@testhotel.com | test1234 |
| FRONT_DESK | frontdesk@testhotel.com | test1234 |
| HOUSEKEEPING | housekeeping@testhotel.com | test1234 |
| MAINTENANCE | maintenance@testhotel.com | test1234 |
| VIEWER | viewer@testhotel.com | test1234 |

### Endpoints

- Backend API: `http://localhost:8000/api`
- Frontend UI: `http://localhost:5173`

### Running Backend E2E Tests

```bash
# All E2E tests (requires running Docker stack with seeded DB)
cd backend && npx vitest --project=e2e

# Single module
cd backend && npx vitest --project=e2e src/services/auth/__tests__/auth_e2e.test.ts

# Unit tests only (mocked, no Docker)
cd backend && npx vitest --project=unit
```

---

## 3. Test Legend

Each test case has:
- **UC**: Use case ID from [USE_CASES.md](file:///home/abdallah/Projects/freelance/hotelmanangement/docs/USE_CASES.md)
- **Type**: `API` (supertest/curl), `UI` (browser), `Both`
- **Executor**: `Human`, `Antigravity`, `Both`
- **Priority**: `P0` (must pass), `P1` (important), `P2` (nice to have)
- **Existing**: ✅ = test exists, ❌ = needs creation

---

## 4. Module Test Suites

### 4.1 Authentication & Authorization (UC-001 – UC-006)

**Existing file:** [auth_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/auth/__tests__/auth_e2e.test.ts) — **15 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| A1 | Login with valid ADMIN creds → JWT + refresh token | UC-001 | API | Both | P0 | ✅ |
| A2 | Login with invalid password → 401 | UC-001 | API | Both | P0 | ✅ |
| A3 | Login → frontend redirects to dashboard | UC-001 | UI | Both | P0 | ❌ |
| A4 | Logout clears tokens, redirects to login | UC-002 | UI | Both | P0 | ❌ |
| A5 | Valid refresh token → new access token | UC-003 | API | Antigravity | P0 | ✅ |
| A6 | Forgot password → 200 (anti-enumeration) | UC-004 | API | Antigravity | P1 | ✅ |
| A7 | Change password with wrong current → error | UC-005 | API | Antigravity | P1 | ✅ |
| A8 | Change password unauthenticated → 401 | UC-005 | API | Antigravity | P1 | ✅ |
| A9 | SUPER_ADMIN create user with FRONT_DESK role | UC-006 | API | Antigravity | P0 | ✅ |
| A10 | VIEWER cannot list/create users → 403 | UC-006 | API | Antigravity | P0 | ✅ |
| A11 | All protected routes → 401 without token | UC-006 | API | Antigravity | P0 | ✅ (9 routes) |

#### UI Test: A3 — Login Flow
1. Open `http://localhost:5173`
2. Enter `admin@hotel.com` / `admin123`
3. Click **Login** button
4. **Verify**: Redirected to Dashboard page; stats cards visible

#### UI Test: A4 — Logout Flow
1. After login, click user avatar / menu
2. Click **Logout**
3. **Verify**: Redirected to login page; `localStorage` cleared of tokens

---

### 4.2 Guest Management (UC-101 – UC-107)

**Existing file:** [guests_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/guests/__tests__/guests_e2e.test.ts) — **8 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| G1 | Create guest with name, email, phone → 201 | UC-101 | Both | Both | P0 | ✅ |
| G2 | Create guest without first_name → 400/422 | UC-101 | API | Antigravity | P0 | ✅ |
| G3 | View guest list + single profile by ID | UC-102 | Both | Both | P0 | ✅ |
| G4 | Update guest phone → 200 | UC-103 | Both | Both | P0 | ✅ |
| G5 | Search guests by name → filtered list | UC-104 | UI | Both | P0 | ✅ (API) |
| G6 | View guest history (past reservations) | UC-105 | UI | Human | P1 | ❌ |
| G7 | Merge duplicate guest records (API) | UC-106 | API | Antigravity | P2 | ❌ |
| G8 | Add timestamped note to guest | UC-107 | UI | Both | P1 | ❌ |
| G9 | 404 for non-existent guest ID | UC-102 | API | Antigravity | P1 | ✅ |
| G10 | VIEWER cannot create guests → 403 | UC-101 | API | Antigravity | P0 | ✅ |
| G11 | Missing X-Hotel-Id → 400/401 | Tenancy | API | Antigravity | P0 | ✅ |

#### UI Test: G5 — Guest Search
1. Login as ADMIN → Navigate to **Guests** page
2. Type a known guest name in search input
3. **Verify**: Table filters to matching guests
4. Clear search → full list returns

#### UI Test: G6 — Guest History
1. Login as MANAGER → Navigate to **Guests** → Click a guest name
2. **Verify**: GuestProfilePage loads with contact info and reservation history section

---

### 4.3 Room Management (UC-201 – UC-209) + Housekeeping (UC-501 – UC-507)

**Existing file:** [rooms_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/rooms/__tests__/rooms_e2e.test.ts) — **12 tests** (includes housekeeping)

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| R1 | Create room with number, type, floor → 201 | UC-201 | Both | Both | P0 | ✅ |
| R2 | View room list + details by ID | UC-202 | UI | Both | P0 | ✅ |
| R3 | MANAGER update room status → 200 | UC-203/204 | API | Antigravity | P1 | ✅ |
| R4 | ADMIN mark room Out of Service → then restore | UC-209 | Both | Both | P0 | ✅ |
| R5 | Filter rooms by status=Available | UC-205 | UI | Both | P0 | ✅ |
| R6 | Check room availability for date range | UC-206 | API | Antigravity | P0 | ❌ |
| R7 | MANAGER cannot create rooms → 403 | UC-201 | API | Antigravity | P0 | ✅ |
| R8 | VIEWER can view rooms → 200, cannot update → 403 | UC-202 | API | Antigravity | P0 | ✅ |
| H1 | GET /housekeeping → 200 list | UC-501 | Both | Both | P0 | ✅ |
| H2 | HOUSEKEEPING update cleaning status → 200 | UC-502 | Both | Both | P0 | ✅ |
| H3 | Mark room as Clean | UC-504 | UI | Both | P0 | ✅ |
| H4 | VIEWER cannot update housekeeping → 403 | UC-502 | API | Antigravity | P0 | ✅ |
| H5 | After checkout, room auto-marked Dirty/Cleaning | UC-505 | Both | Both | P0 | ✅ (in check_ins_e2e) |

#### UI Test: R2 — Room Details
1. Login as ADMIN → Navigate to **Rooms** page
2. **Verify**: Grid/table of rooms with status badges
3. Click a room → View room details
4. **Verify**: Room number, type, floor, status displayed

#### UI Test: H1 — Housekeeping Dashboard
1. Login as HOUSEKEEPING → Navigate to **Rooms** page
2. Switch to **Housekeeping** tab/view
3. **Verify**: Room cards show cleaning status (Clean/Dirty/Cleaning)
4. Click a room → Update status → **Verify** change reflected

---

### 4.4 Reservation Management (UC-301 – UC-312)

**Existing file:** [reservations_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/reservations/__tests__/reservations_e2e.test.ts) — **7 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| RV1 | Create reservation: guest, room type, dates → 201 | UC-301 | Both | Both | P0 | ✅ |
| RV2 | check_out before check_in → 400/422 | UC-301 | API | Antigravity | P0 | ✅ |
| RV3 | View reservation list + single by ID | UC-302 | UI | Both | P0 | ✅ |
| RV4 | Update reservation (change dates) | UC-303 | API | Antigravity | P1 | ❌ |
| RV5 | Cancel reservation → status Cancelled | UC-304 | Both | Both | P0 | ✅ |
| RV6 | VIEWER cannot create → 403 | UC-301 | API | Antigravity | P0 | ✅ |
| RV7 | VIEWER can read reservations → 200 | UC-302 | API | Antigravity | P0 | ✅ |
| RV8 | Search by status=Confirmed → filtered | UC-307 | UI | Both | P1 | ✅ |
| RV9 | Check availability for date range → 200 | UC-310 | API | Antigravity | P0 | ✅ |
| RV10 | View reservation calendar (BookingTimeline) | UC-308 | UI | Human | P1 | ❌ |
| RV11 | Double room: add secondary guest | UC-309/312 | Both | Both | P1 | ❌ |

#### UI Test: RV3 — Reservation Details
1. Login as FRONT_DESK → Navigate to **Reservations** page
2. **Verify**: List of reservations with status column
3. Click a reservation → View details
4. **Verify**: Guest name, room type, dates, status displayed

#### UI Test: RV10 — Calendar View
1. Login as MANAGER → Navigate to **Calendar** page
2. **Verify**: BookingTimeline component renders timeline bars
3. Click a reservation bar → Details shown

---

### 4.5 Check-in / Check-out (UC-305 – UC-306)

**Existing file:** [check_ins_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/check_ins/__tests__/check_ins_e2e.test.ts) — **7 tests** (full lifecycle)

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| CI1 | List check-ins for hotel → 200 | UC-305 | API | Antigravity | P0 | ✅ |
| CI2 | Create reservation → get eligible rooms → check-in → verify status | UC-305 | Both | Both | P0 | ✅ |
| CI3 | Reject duplicate check-in → 400/409 | UC-305 | API | Antigravity | P0 | ✅ |
| CI4 | Check-out → room Cleaning, reservation Checked-out | UC-306 | Both | Both | P0 | ✅ |
| CI5 | Auto-invoice created after checkout | UC-409 | API | Antigravity | P0 | ✅ |
| CI6 | Cannot checkout already-checked-out → 400/409 | UC-306 | API | Antigravity | P0 | ✅ |
| CI7 | VIEWER cannot create check-in → 403 | UC-305 | API | Antigravity | P0 | ✅ |

> [!IMPORTANT]
> **Full Lifecycle E2E (most critical test):** Reservation → Eligible Rooms → Check-in → Check-out → Invoice. This is already automated in `check_ins_e2e.test.ts` (Steps 1–4 + UC-409).

#### UI Test: CI2 — Full Check-in Flow
1. Login as FRONT_DESK
2. Go to **Guests** → **Add Guest** → Fill `Test E2E`, `test@e2e.com` → Save
3. Go to **Reservations** → **Add Reservation**
4. Select guest, select room type, enter today's date + 2 days
5. Save → **Verify** reservation appears as "Confirmed"
6. Find reservation → Click **Check-in** → Select room → Confirm
7. **Verify**: Status → "Checked-in"
8. Go to **Rooms** → **Verify**: Room shows "Occupied"
9. Go to **Check-ins** → Find active check-in → Click **Checkout** → Confirm
10. **Verify**: Status → "Checked-out"
11. Go to **Invoices** → **Verify**: Auto-generated invoice appears

---

### 4.6 Invoice & Payment Management (UC-401 – UC-409)

**Existing file:** [invoices_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/invoices/__tests__/invoices_e2e.test.ts) — **8 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| I1 | Create invoice for reservation → 201 | UC-401 | Both | Both | P0 | ✅ |
| I2 | View invoice list + by ID | UC-402 | UI | Both | P0 | ✅ |
| I3 | Mark invoice as Paid with payment method | UC-405 | Both | Both | P0 | ✅ |
| I4 | Cancel invoice → status Cancelled | UC-406 | API | Antigravity | P1 | ✅ |
| I5 | PDF download → binary response | UC-407 | API | Antigravity | P1 | ✅ |
| I6 | VIEWER can view, cannot create → 403 | UC-402 | API | Antigravity | P0 | ✅ |
| I7 | Auto-invoice on checkout (covered by CI5) | UC-409 | Both | Both | P0 | ✅ |

#### UI Test: I3 — Mark Invoice Paid
1. Login as MANAGER → Navigate to **Invoices** page
2. Find a "Pending" invoice → Click **Mark Paid**
3. Select payment method (Cash/Card/Online) → Confirm
4. **Verify**: Invoice status changes to "Paid"

---

### 4.7 Maintenance Management (UC-601 – UC-607)

**Existing file:** [maintenance_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/maintenance/__tests__/maintenance_e2e.test.ts) — **8 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| M1 | Create maintenance request → status Open | UC-601 | Both | Both | P0 | ✅ |
| M2 | View all requests (scoped to hotel_id) | UC-602 | UI | Both | P0 | ✅ |
| M3 | Update Open → In Progress → Repaired | UC-603/605 | Both | Both | P0 | ✅ |
| M4 | Set priority (Low/Medium/High/Urgent) | UC-604 | API | Antigravity | P1 | ✅ |
| M5 | Filter by status=Repaired | UC-606 | UI | Both | P1 | ✅ |
| M6 | VIEWER cannot create → 403 | UC-601 | API | Antigravity | P0 | ✅ |
| M7 | Hotel tenancy: all requests have matching hotel_id | UC-602 | API | Antigravity | P0 | ✅ |
| M8 | Validation: missing room_id → 400/422 | UC-601 | API | Antigravity | P1 | ✅ |

#### UI Test: M1 — Create Maintenance Request
1. Login as FRONT_DESK → Navigate to **Maintenance** page
2. Click **New Request**
3. Select room, enter title "Broken AC", select priority "High"
4. Save → **Verify**: Request appears in list with status "Open"

---

### 4.8 Expense Management (UC-701 – UC-707)

**Existing file:** [expenses_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/expenses/__tests__/expenses_e2e.test.ts) — **9 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| E1 | Create expense with amount, category → 201 | UC-701 | Both | Both | P0 | ✅ |
| E2 | View expense list | UC-702 | UI | Both | P0 | ✅ |
| E3 | Update expense description/amount | UC-703 | API | Antigravity | P1 | ✅ |
| E4 | Delete expense — ADMIN only, MANAGER → 403 | UC-704 | API | Antigravity | P1 | ✅ |
| E5 | Filter by category=Utilities | UC-707 | UI | Both | P1 | ✅ |
| E6 | VIEWER can view, cannot create → 403 | UC-702 | API | Antigravity | P0 | ✅ |
| E7 | FRONT_DESK cannot create → 403 | UC-701 | API | Antigravity | P0 | ✅ |
| E8 | GET /expenses/stats → 200 | UC-706 | API | Antigravity | P1 | ✅ |

---

### 4.9 Reporting & Analytics (UC-801 – UC-808)

**Existing file:** [reports_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/reports/__tests__/reports_e2e.test.ts) — **5 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| RP1 | Dashboard stats → occupancy + revenue data | UC-801 | Both | Both | P0 | ✅ |
| RP2 | MANAGER and VIEWER can view stats | UC-801 | API | Antigravity | P0 | ✅ |
| RP3 | Dashboard charts render (pie, bar, line) | UC-801 | UI | Human | P0 | ❌ |
| RP4 | Export CSV → binary CSV response | UC-806 | API | Antigravity | P1 | ✅ |
| RP5 | Revenue report totals are correct | UC-802 | API | Antigravity | P1 | ❌ |
| RP6 | Cancellation rate on dashboard | UC-807 | UI | Human | P2 | ❌ |
| RP7 | Unauthenticated stats → 401 | UC-801 | API | Antigravity | P0 | ✅ |

#### UI Test: RP3 — Dashboard Verification
1. Login as MANAGER → Land on **Dashboard** page
2. **Verify** cards: Total Rooms, Occupied, Available, Today's Check-ins/outs, Revenue
3. **Verify** charts render (Recharts pie, bar, line — not empty)
4. Click a stat card → Navigate to detail page

---

### 4.10 Audit & Compliance (UC-901 – UC-905)

**Existing file:** [audit_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/audit/__tests__/audit_e2e.test.ts) — **8 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| AU1 | ADMIN list audit logs → 200 | UC-901 | Both | Both | P0 | ✅ |
| AU2 | VIEWER can read audit logs → 200 | UC-901 | API | Antigravity | P0 | ✅ |
| AU3 | Filter by entity_type=guest/reservation | UC-902/904 | UI | Both | P1 | ✅ |
| AU4 | Export CSV → 200 or 501 | UC-903 | API | Antigravity | P1 | ✅ |
| AU5 | Tenancy: logs scoped to hotel_id | UC-901 | API | Antigravity | P0 | ✅ |
| AU6 | Creating guest → audit log entry created | UC-901 | API | Antigravity | P0 | ✅ |
| AU7 | Unauthenticated → 401 | UC-901 | API | Antigravity | P0 | ✅ |

#### UI Test: AU3 — Audit Log Filtering
1. Login as ADMIN → Navigate to **Audit Logs** page
2. Select entity type filter → "reservation"
3. **Verify**: Only reservation-related logs shown
4. Clear filter → full list returns

---

### 4.11 QloApps Integration (UC-1001 – UC-1008)

**Existing tests:** None

> [!NOTE]
> QloApps tests require a running QloApps instance (`docker compose --profile infra up -d`). All tests are **P2** unless a QloApps test environment is available.

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| Q1 | Configure QloApps settings (API URL, creds) | UC-1008 | UI | Human | P2 | ❌ |
| Q2 | Test QloApps connection → success/failure | UC-1008 | UI | Human | P2 | ❌ |
| Q3 | Trigger manual sync | UC-1007 | API | Antigravity | P2 | ❌ |
| Q4 | View sync status | UC-1006 | UI | Human | P2 | ❌ |
| Q5 | Sync status API → last sync time | UC-1006 | API | Antigravity | P2 | ❌ |

#### UI Test: Q1 — QloApps Configuration
1. Login as ADMIN → Navigate to **Settings** → **Channel Manager** tab
2. Enter QloApps API URL, credentials
3. Click **Save** → **Verify**: Settings persisted
4. Click **Test Connection** → **Verify**: Success/failure feedback

---

### 4.12 Notifications (UC-1101 – UC-1106)

**Existing file:** [notifications_e2e.test.ts](file:///home/abdallah/Projects/freelance/hotelmanangement/backend/src/services/notifications/__tests__/notifications_e2e.test.ts) — **5 tests**

| # | Test Case | UC | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|---|
| N1 | View notification inbox → 200 array | UC-1101 | UI | Both | P0 | ✅ |
| N2 | Mark single notification as read | UC-1102 | Both | Both | P1 | ✅ |
| N3 | Mark all notifications as read | UC-1102 | API | Antigravity | P1 | ✅ |
| N4 | Check-in creates notification (count increases) | UC-1103 | API | Antigravity | P0 | ✅ |
| N5 | Unauthenticated → 401 | UC-1101 | API | Antigravity | P0 | ✅ |
| N6 | Check-out creates notification for housekeeping | UC-1104 | API | Antigravity | P0 | ❌ |
| N7 | Maintenance create → notification generated | UC-1105 | API | Antigravity | P0 | ❌ |

#### UI Test: N1 — Notification Bell
1. Login as ADMIN → Look for bell icon in top nav
2. Click bell → **Verify**: Notification dropdown/panel opens with recent items
3. Click a notification → **Verify**: Marked as read

---

## 5. Cross-Cutting Tests

### 5.1 Multi-Property Tenancy

| # | Test Case | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|
| T1 | All data APIs require `X-Hotel-Id` → 400 without it | API | Antigravity | P0 | ✅ (guests_e2e) |
| T2 | User can only access assigned hotels | API | Antigravity | P0 | ❌ |
| T3 | SUPER_ADMIN can access any hotel | API | Antigravity | P0 | ❌ |
| T4 | Frontend hotel selector switches context | UI | Human | P0 | ❌ |
| T5 | Data from Hotel A not visible when Hotel B selected | UI | Both | P0 | ❌ |

#### UI Test: T4 — Hotel Selector
1. Login as SUPER_ADMIN (with access to multiple hotels)
2. **Verify**: Hotel selector/dropdown visible
3. Switch hotel → **Verify**: All data reloads with new hotel context
4. Navigate to Rooms → **Verify**: Different rooms for different hotel

### 5.2 RBAC Matrix

| # | Test Case | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|
| RBAC1 | VIEWER: read all, no create/update/delete | API | Antigravity | P0 | ✅ (per module) |
| RBAC2 | FRONT_DESK: manage reservations/guests, no users | API | Antigravity | P0 | ✅ |
| RBAC3 | HOUSEKEEPING: update room cleaning status only | API | Antigravity | P0 | ✅ |
| RBAC4 | MAINTENANCE: create/update maintenance requests | API | Antigravity | P0 | ✅ |
| RBAC5 | ADMIN: full hotel access, user management | API | Antigravity | P0 | ✅ |
| RBAC6 | SUPER_ADMIN: create hotels, access all hotels | API | Antigravity | P0 | ✅ (partial) |

> All RBAC tests are distributed across individual module E2E files. Each module tests VIEWER → 403 for mutations and 200 for reads.

### 5.3 Security

| # | Test Case | Type | Executor | Priority | Existing |
|---|---|---|---|---|---|
| S1 | All protected routes → 401 without token | API | Antigravity | P0 | ✅ (auth_e2e, 9 routes) |
| S2 | JWT expiry + refresh flow works | API | Antigravity | P1 | ✅ |
| S3 | Password hash never returned in response | API | Antigravity | P0 | ✅ |
| S4 | `ALLOW_DEFAULT_HOTEL=false` in production | API | Antigravity | P0 | ❌ |

---

## 6. Manual / User-Facing Test Checklist

This section is specifically for **human testers** performing browser-based testing. Each scenario is self-contained with step-by-step instructions.

---

### 🔐 MT-1: Login & Logout (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open `http://localhost:5173` | Login page displayed |
| 2 | Enter email `admin@hotel.com`, password `admin123` | Fields accept input |
| 3 | Click **Login** | Redirected to Dashboard |
| 4 | **Verify** dashboard shows stat cards | Total Rooms, Occupied, Revenue visible |
| 5 | Click user menu/avatar → **Logout** | Redirected to login page |
| 6 | Try accessing `http://localhost:5173/dashboard` directly | Redirected to login (no auth) |

---

### 👤 MT-2: Guest CRUD & Search (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as FRONT_DESK (`frontdesk@testhotel.com` / `test1234`) | Dashboard loads |
| 2 | Navigate to **Guests** page (sidebar) | Guest list displayed |
| 3 | Click **Add Guest** | Form/modal opens |
| 4 | Fill: First Name = "Manual", Last Name = "Tester", Email = "manual@test.com" | Fields accept input |
| 5 | Click **Save** | Success toast; guest appears in list |
| 6 | Type "Manual" in search box | List filters to show "Manual Tester" |
| 7 | Clear search | Full list returns |
| 8 | Click "Manual Tester" name | Guest profile page opens |
| 9 | Edit phone number → Save | Success; phone updated |

---

### 🏨 MT-3: Full Reservation Lifecycle (P0)

> This is the **most important manual test** — validates the core business flow end-to-end.

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as FRONT_DESK | Dashboard |
| 2 | **Guests** → **Add Guest** → Fill form → Save | New guest created |
| 3 | **Reservations** → **Add Reservation** | Form opens |
| 4 | Select the new guest | Guest selected |
| 5 | Select room type (e.g., "Standard") | Type selected |
| 6 | Set check-in = today, check-out = today + 2 days | Dates set |
| 7 | Click **Save** | Reservation created with "Confirmed" status |
| 8 | Find reservation in list → Click **Check-in** | Check-in modal opens |
| 9 | Select available room from dropdown → **Confirm** | Check-in successful |
| 10 | **Verify**: Reservation status → "Checked-in" | ✓ |
| 11 | Navigate to **Rooms** | Room shows "Occupied" badge |
| 12 | Navigate to **Check-ins** → Find active check-in | Check-in row visible |
| 13 | Click **Checkout** → Confirm | Checkout successful |
| 14 | **Verify**: Reservation status → "Checked-out" | ✓ |
| 15 | Navigate to **Rooms** | Room shows "Cleaning" badge |
| 16 | Navigate to **Invoices** | Auto-generated invoice visible |

---

### 💰 MT-4: Invoice Payment (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as MANAGER | Dashboard |
| 2 | Navigate to **Invoices** page | Invoice list with status column |
| 3 | Find a "Pending" invoice | Status = Pending |
| 4 | Click **Mark Paid** | Payment modal opens |
| 5 | Select "Cash" → Confirm | Invoice status → "Paid" |
| 6 | **Verify**: Status badge updated | ✓ |

---

### 🧹 MT-5: Housekeeping Flow (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as HOUSEKEEPING (`housekeeping@testhotel.com` / `test1234`) | Dashboard |
| 2 | Navigate to **Rooms** → Housekeeping view | Room cards with cleaning status |
| 3 | Find a room with "Dirty" status | Dirty badge visible |
| 4 | Click room → Update status to "Clean" | Status updated |
| 5 | **Verify**: Room card now shows "Clean" | ✓ |

---

### 🔧 MT-6: Maintenance Request (P1)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as MAINTENANCE (`maintenance@testhotel.com` / `test1234`) | Dashboard |
| 2 | Navigate to **Maintenance** page | Request list |
| 3 | Click **New Request** | Form opens |
| 4 | Select room, title = "Leaky faucet", priority = "High" | Fields filled |
| 5 | Click **Save** | Request created with "Open" status |
| 6 | Click the new request → Change status to "In Progress" | Status updated |
| 7 | Change status to "Repaired" | Status updated |

---

### 📊 MT-7: Dashboard & Reports (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as MANAGER | Dashboard auto-loads |
| 2 | **Verify** stat cards: Total Rooms, Occupied, Available, Today's Check-ins/outs | Numbers displayed |
| 3 | **Verify** charts: Pie (reservations by status), Bar (revenue), Line (occupancy) | Charts render (not blank) |
| 4 | Navigate to **Reports** page | Reports page loads |
| 5 | **Verify** report data matches dashboard summary | Consistent numbers |

---

### 📋 MT-8: Audit Logs (P1)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as ADMIN | Dashboard |
| 2 | Navigate to **Audit Logs** page | Log entries displayed |
| 3 | Filter by entity type "reservation" | Only reservation logs shown |
| 4 | Clear filter | Full list returns |
| 5 | **Verify**: Recent operations (from MT-3) appear in logs | ✓ |

---

### 🔔 MT-9: Notifications (P1)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as ADMIN | Dashboard |
| 2 | Look for bell icon in header/nav bar | Bell icon visible |
| 3 | Click bell icon | Notification panel/dropdown opens |
| 4 | **Verify**: Recent notifications shown | List of notifications |
| 5 | Click a notification | Marked as read (visual change) |

---

### 👥 MT-10: Role-Based Access (P0)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as VIEWER (`viewer@testhotel.com` / `test1234`) | Dashboard |
| 2 | Navigate to **Guests** page | Guest list visible (read-only) |
| 3 | **Verify**: No "Add Guest" button / button disabled | Cannot create |
| 4 | Navigate to **Rooms** | Room list visible |
| 5 | Navigate to **Settings** | Settings page or 403/hidden |
| 6 | **Verify**: No create/edit/delete actions available anywhere | Read-only access |

---

### 🏢 MT-11: Multi-Property (P0, if multiple hotels seeded)

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as SUPER_ADMIN | Dashboard |
| 2 | Look for hotel selector (dropdown/switcher) | Hotel selector visible |
| 3 | Note current rooms count | Count A |
| 4 | Switch to different hotel | Data reloads |
| 5 | **Verify**: Room list changes | Different rooms |
| 6 | Switch back | Original rooms return |

---

## 7. Execution Strategy

### Phase 1 — Smoke Tests (P0 only) — *Day 1*

**Run by:** Antigravity (API) + Human (UI)

```bash
# API: Run all existing backend E2E tests
cd backend && npx vitest --project=e2e
```

**Human:** Execute MT-1, MT-3, MT-10

**Total: ~50 automated + 3 manual scenarios**

### Phase 2 — Functional Tests (P0 + P1) — *Days 2–3*

**Run by:** Both

- Create missing E2E tests: `room_types_e2e.test.ts`, checkout notification test (N6/N7)
- Human: Execute MT-2, MT-4, MT-5, MT-6, MT-7, MT-8, MT-9

**Total: ~70 automated + 9 manual scenarios**

### Phase 3 — Edge Cases & Integration (all priorities) — *Days 4–5*

**Run by:** Both

- QloApps tests (Q1–Q5, if infrastructure available)
- Multi-property tenancy tests (T2–T5, MT-11)
- Double room secondary guest flows (RV11)
- Calendar view validation (RV10)

**Total: ~85 automated + 11 manual scenarios**

---

## 8. Automation Recommendations

### Missing E2E Tests to Create

| File | Module | Tests |
|---|---|---|
| `room_types/__tests__/room_types_e2e.test.ts` | Room Types | CRUD, pricing, RBAC |
| `hotels/__tests__/hotels_e2e.test.ts` | Hotels | List, create, assign users |
| `notifications/__tests__/notifications_e2e.test.ts` (extend) | Notifications | N6 (checkout notif), N7 (maintenance notif) |
| `reservations/__tests__/reservations_e2e.test.ts` (extend) | Reservations | RV4 (update dates), RV11 (secondary guest) |

### Browser UI Tests (Antigravity browser subagent)

For P0 UI tests, Antigravity should:
1. Navigate to `http://localhost:5173`
2. Authenticate as the required role
3. Perform the test scenario
4. Capture screenshots as evidence

---

## 9. Known Gaps (Not Testable Yet)

| Gap | UC | Status |
|---|---|---|
| Guest merge UI workflow | UC-106 | API exists (`POST /v1/guests/:id/merge`), no dedicated UI |
| Housekeeping schedule view | UC-506 | Not implemented |
| QloApps conflict resolution UI | UC-1005 | API only |
| QloApps sync logs UI | UC-1006 | API only |
| Advanced occupancy forecast model | UC-808 | Partial (chart exists, model depth unclear) |

---

## 10. Test Reporting

Each execution should produce:
- **Pass/Fail** status per test case
- **Screenshots** for UI tests (saved to artifacts)
- **API response bodies** for API tests (vitest output)
- **Timestamp** of execution
- **Environment** (dev/staging/prod)

---

*End of testing plan.*
