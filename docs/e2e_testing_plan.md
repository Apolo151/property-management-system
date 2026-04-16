# Hotel PMS — End-to-End Testing Plan

> Based on [USE_CASES.md](file:///home/abdallah/Projects/freelance/hotelmanangement/docs/USE_CASES.md), gap report, and full codebase review (2026-04-16).

---

## 1. Executive Summary

This testing plan covers **all 12 modules** from USE_CASES.md across **backend API**, **frontend UI**, and **cross-cutting concerns**. It is designed to be executed by both **humans** (manual browser testing) and **Antigravity** (automated API tests + browser subagent).

### Current Test Coverage

| Layer | Status |
|---|---|
| Backend unit tests | 6 files — `check_ins_service` (skipped), `audit_rbac`, `audit_tenancy`, `expenses_rbac`, `maintenance_tenancy`, `hotel_date`, `users_auth` |
| Frontend unit tests | **None** (Storybook stories only) |
| E2E / integration tests | **None** |
| Test runner (backend) | vitest + supertest available |
| Test runner (frontend) | Not configured (vitest deps not installed) |

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

> [!IMPORTANT]
> Populate the table above from `backend/src/database/seeds/` before executing tests.

### API Base URL
- Dev: `http://localhost:8000/api`
- Frontend: `http://localhost:5173`

---

## 3. Module Test Suites

Each test case has:
- **UC**: Use case ID from USE_CASES.md
- **Type**: `API` (curl/supertest), `UI` (browser), `Both`
- **Executor**: `Human`, `Antigravity`, or `Both`
- **Priority**: `P0` (must pass), `P1` (important), `P2` (nice to have)

---

### 3.1 Authentication & Authorization (UC-001 – UC-006)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| A1 | Login with valid ADMIN credentials → receives JWT + refresh token | UC-001 | API | Both | P0 |
| A2 | Login with invalid password → 401 error | UC-001 | API | Both | P0 |
| A3 | Login → frontend redirects to dashboard | UC-001 | UI | Both | P0 |
| A4 | Logout clears tokens from localStorage, redirects to login | UC-002 | UI | Both | P0 |
| A5 | Access `/v1/rooms` with expired token → auto-refresh and retry | UC-003 | API | Antigravity | P1 |
| A6 | Forgot password sends reset link (logged to console if no SMTP) | UC-004 | API | Antigravity | P1 |
| A7 | Change password with correct current password | UC-005 | API | Antigravity | P1 |
| A8 | Change password with wrong current password → 400 | UC-005 | API | Antigravity | P1 |
| A9 | Create user with FRONT_DESK role via `/v1/users` (as ADMIN) | UC-006 | API | Antigravity | P0 |
| A10 | VIEWER cannot create users → 403 | UC-006 | API | Antigravity | P0 |
| A11 | RBAC: each role can only access permitted endpoints | UC-006 | API | Antigravity | P0 |

#### API Test Steps (A1 — example)
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hotel.com","password":"password123"}'
# Expect: { "token": "...", "refreshToken": "...", "user": {...} }
```

#### UI Test Steps (A3 — example)
1. Open `http://localhost:5173`
2. Enter valid admin email/password
3. Click "Login" button
4. **Verify**: Redirected to Dashboard page with stats visible

---

### 3.2 Guest Management (UC-101 – UC-107)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| G1 | Create guest with name, email, phone → success | UC-101 | Both | Both | P0 |
| G2 | Create guest with duplicate email → duplicate warning | UC-101 | API | Antigravity | P1 |
| G3 | View guest profile shows contact info, reservation history | UC-102 | UI | Both | P0 |
| G4 | Update guest phone number | UC-103 | Both | Both | P0 |
| G5 | Search guests by name → filters list | UC-104 | UI | Both | P0 |
| G6 | View guest history shows past reservations | UC-105 | UI | Human | P1 |
| G7 | Merge two guest records via API `POST /guests/:id/merge` | UC-106 | API | Antigravity | P2 |
| G8 | Add timestamped note to guest profile | UC-107 | UI | Both | P1 |

#### UI Test Steps (G5)
1. Login as ADMIN
2. Navigate to **Guests** page
3. Type guest name in search input
4. **Verify**: Table filters to show matching guests
5. Clear search
6. **Verify**: Full list returns

---

### 3.3 Room Management (UC-201 – UC-209)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| R1 | Create room with number, type, floor → success | UC-201 | Both | Both | P0 |
| R2 | View room details page | UC-202 | UI | Both | P0 |
| R3 | Update room information | UC-203 | API | Antigravity | P1 |
| R4 | Update room status (Available → Out of Service) | UC-204 | Both | Both | P0 |
| R5 | Filter rooms by status and type | UC-205 | UI | Both | P0 |
| R6 | Check room availability for date range | UC-206 | API | Antigravity | P0 |
| R7 | Set room rate via room type `price_per_night` | UC-207 | API | Antigravity | P1 |
| R8 | Mark room out of service | UC-209 | UI | Human | P1 |

---

### 3.4 Reservation Management (UC-301 – UC-312)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| RV1 | Create reservation: select guest, room type, dates → success | UC-301 | Both | Both | P0 |
| RV2 | Create reservation with date conflict → warning message | UC-301 | API | Antigravity | P0 |
| RV3 | View reservation details | UC-302 | UI | Both | P0 |
| RV4 | Update reservation (change dates) | UC-303 | API | Antigravity | P1 |
| RV5 | Cancel reservation → status changes to "Cancelled" | UC-304 | Both | Both | P0 |
| RV6 | Check-in guest: Confirmed → Checked-in, room → Occupied | UC-305 | Both | Both | P0 |
| RV7 | Check-in: reject if already checked-in | UC-305 | API | Antigravity | P0 |
| RV8 | Check-in: reject if room not available | UC-305 | API | Antigravity | P0 |
| RV9 | Check-out guest: room → Cleaning, auto-invoice created | UC-306 | Both | Both | P0 |
| RV10 | Check-out: reject if not checked-in | UC-306 | API | Antigravity | P0 |
| RV11 | Search reservations by guest name and status | UC-307 | UI | Both | P1 |
| RV12 | View reservation calendar (BookingTimeline) | UC-308 | UI | Human | P1 |
| RV13 | Double room: add secondary guest to reservation | UC-309/312 | Both | Both | P1 |
| RV14 | Check availability for date range | UC-310 | API | Antigravity | P0 |

#### Full E2E Scenario: Reservation Lifecycle (RV1 → RV6 → RV9)

This is the **most critical** test — it validates the core business flow:

**API Steps (Antigravity):**
```bash
# 1. Create guest
POST /api/v1/guests { "first_name": "Test", "last_name": "Guest", "email": "test@e2e.com" }

# 2. Create reservation (status: Confirmed)
POST /api/v1/reservations { "primary_guest_id": "<guest_id>", "room_type_id": "<type_id>", "check_in": "2026-04-20", "check_out": "2026-04-22", "status": "Confirmed" }

# 3. Get eligible rooms
GET /api/v1/reservations/<reservation_id>/eligible-rooms

# 4. Check-in
POST /api/v1/reservations/<reservation_id>/check-in { "actual_room_id": "<room_id>" }
# Verify: reservation status = "Checked-in", room status = "Occupied"

# 5. Check-out
PATCH /api/v1/check-ins/<checkin_id>/checkout {}
# Verify: reservation status = "Checked-out", room status = "Cleaning"
# Verify: invoice auto-created
```

**UI Steps (Human):**
1. Login as FRONT_DESK
2. Go to **Guests** → Click **Add Guest** → Fill form → Save
3. Go to **Reservations** → Click **Add Reservation**
4. Select guest, select room type, enter check-in/check-out dates
5. Save → **Verify** reservation appears in list with "Confirmed" status
6. Find reservation → Click **Check-in** → Select room → Confirm
7. **Verify**: Status changes to "Checked-in"
8. Go to **Rooms** → **Verify**: Room shows "Occupied"
9. Go to **Check-ins** → Find active check-in → Click **Checkout** → Confirm
10. **Verify**: Status changes to "Checked-out"
11. Go to **Invoices** → **Verify**: Auto-generated invoice appears

---

### 3.5 Invoice & Payment Management (UC-401 – UC-409)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| I1 | Create invoice manually for a reservation | UC-401 | Both | Both | P0 |
| I2 | View invoice details | UC-402 | UI | Both | P0 |
| I3 | Update invoice status | UC-403 | API | Antigravity | P1 |
| I4 | Mark invoice as paid with payment method (Cash/Card/Online) | UC-405 | Both | Both | P0 |
| I5 | Cancel invoice | UC-406 | API | Antigravity | P1 |
| I6 | Download invoice PDF | UC-407 | API | Antigravity | P1 |
| I7 | Auto-generated invoice on check-out (covered by RV9) | UC-409 | Both | Both | P0 |
| I8 | VIEWER can view but not create/update invoices | UC-402 | API | Antigravity | P0 |

#### UI Test Steps (I4)
1. Login as MANAGER
2. Navigate to **Invoices** page
3. Find a "Pending" invoice → Click **Mark Paid**
4. Select payment method from modal → Confirm
5. **Verify**: Invoice status changes to "Paid"
6. **Verify**: Payment method is recorded

---

### 3.6 Housekeeping Management (UC-501 – UC-507)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| H1 | View housekeeping status for all rooms | UC-501 | UI | Both | P0 |
| H2 | Update cleaning status (Clean → Dirty) | UC-502 | Both | Both | P0 |
| H3 | Assign staff to room for cleaning | UC-503 | API | Antigravity | P1 |
| H4 | Mark room as clean | UC-504 | UI | Both | P0 |
| H5 | After check-out, room auto-marked as Dirty | UC-505 | Both | Both | P0 |
| H6 | Track last cleaned date on room | UC-507 | API | Antigravity | P2 |

#### UI Test Steps (H1)
1. Login as HOUSEKEEPING
2. Navigate to **Rooms** page → Switch to **Housekeeping** tab
3. **Verify**: Room cards show cleaning status (Clean/Dirty/Cleaning)
4. Click a room → Update status → **Verify** change reflected

---

### 3.7 Maintenance Management (UC-601 – UC-607)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| M1 | Create maintenance request with room, title, priority | UC-601 | Both | Both | P0 |
| M2 | View all maintenance requests (filtered by hotel_id) | UC-602 | UI | Both | P0 |
| M3 | Update request status (Open → In Progress → Repaired) | UC-603 | Both | Both | P0 |
| M4 | Priority assignment (Low/Medium/High/Urgent) | UC-604 | API | Antigravity | P1 |
| M5 | Mark request as Repaired | UC-605 | UI | Both | P1 |
| M6 | Search/filter maintenance requests | UC-606 | UI | Both | P1 |
| M7 | Hotel tenancy: request only visible to same hotel_id | UC-602 | API | Antigravity | P0 |

---

### 3.8 Expense Management (UC-701 – UC-707)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| E1 | Create expense with amount, category, description | UC-701 | Both | Both | P0 |
| E2 | View expenses list | UC-702 | UI | Both | P0 |
| E3 | Update expense | UC-703 | API | Antigravity | P1 |
| E4 | Delete expense (ADMIN only) | UC-704 | API | Antigravity | P1 |
| E5 | Filter expenses by category | UC-707 | UI | Both | P1 |
| E6 | VIEWER can view but not create expenses | UC-702 | API | Antigravity | P0 |

---

### 3.9 Reporting & Analytics (UC-801 – UC-808)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| RP1 | Dashboard loads with occupancy, revenue, check-in/out stats | UC-801 | Both | Both | P0 |
| RP2 | Dashboard charts render (pie, bar, line) | UC-801 | UI | Human | P0 |
| RP3 | Revenue report shows correct totals | UC-802 | API | Antigravity | P1 |
| RP4 | Occupancy report shows correct percentages | UC-803 | API | Antigravity | P1 |
| RP5 | Export report as CSV | UC-806 | API | Antigravity | P1 |
| RP6 | Cancellation rate shown on dashboard | UC-807 | UI | Human | P2 |

#### UI Test Steps (RP1)
1. Login as MANAGER
2. Land on **Dashboard** page
3. **Verify** cards show: Total Rooms, Occupied, Available, Today's Check-ins/outs, Revenue
4. **Verify** charts render (not empty/error state)
5. Click a stat card → Navigate to detail page → **Verify** navigation works

---

### 3.10 Audit & Compliance (UC-901 – UC-905)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| AU1 | View audit logs (scoped to hotel_id) | UC-901 | Both | Both | P0 |
| AU2 | Search audit logs by entity type | UC-902 | UI | Both | P1 |
| AU3 | Export audit logs as CSV | UC-903 | API | Antigravity | P1 |
| AU4 | Filter audit logs by entity (guest, room, reservation) | UC-904 | UI | Both | P1 |
| AU5 | VIEWER can read audit logs | UC-901 | API | Antigravity | P0 |
| AU6 | Creating a reservation generates an audit log entry | UC-901 | API | Antigravity | P0 |

#### API Test Steps (AU6)
```bash
# 1. Create a reservation (record timestamp)
POST /api/v1/reservations { ... }

# 2. Fetch audit logs filtered by entity=reservation
GET /api/v1/audit-logs?entity_type=reservation

# 3. Verify: latest log entry references the created reservation
```

---

### 3.11 QloApps Integration (UC-1001 – UC-1008)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| Q1 | Configure QloApps settings (API URL, credentials) | UC-1008 | UI | Human | P1 |
| Q2 | Test QloApps connection → success/failure feedback | UC-1008 | UI | Human | P1 |
| Q3 | Trigger manual sync | UC-1007 | API | Antigravity | P2 |
| Q4 | View sync status | UC-1006 | UI | Human | P2 |
| Q5 | Sync status API returns last sync time and status | UC-1006 | API | Antigravity | P2 |

> [!NOTE]
> QloApps tests require a running QloApps instance. If unavailable, test with `--profile infra` or mock. Mark as P2 if no QloApps test environment exists.

---

### 3.12 Notifications (UC-1101 – UC-1106)

| # | Test Case | UC | Type | Executor | Priority |
|---|---|---|---|---|---|
| N1 | View notification inbox (bell icon) | UC-1101 | UI | Both | P0 |
| N2 | Mark notification as read | UC-1102 | Both | Both | P1 |
| N3 | Mark all notifications as read | UC-1102 | API | Antigravity | P1 |
| N4 | Check-in creates notification for housekeeping staff | UC-1103 | API | Antigravity | P0 |
| N5 | Maintenance create generates notification | UC-1105 | API | Antigravity | P0 |
| N6 | Check-out creates notification for housekeeping | UC-1104 | API | Antigravity | P0 |

#### API Test Steps (N4)
```bash
# 1. Login as FRONT_DESK, perform check-in
POST /api/v1/reservations/<id>/check-in { "actual_room_id": "<room>" }

# 2. Login as HOUSEKEEPING user
# 3. Fetch notifications
GET /api/v1/notifications

# 4. Verify: notification about the check-in exists
```

---

## 4. Cross-Cutting Tests

### 4.1 Multi-Property Tenancy

| # | Test Case | Type | Executor | Priority |
|---|---|---|---|---|
| T1 | All data APIs require `X-Hotel-Id` header → 400 without it | API | Antigravity | P0 |
| T2 | User can only access hotels they're assigned to | API | Antigravity | P0 |
| T3 | SUPER_ADMIN can access any hotel | API | Antigravity | P0 |
| T4 | Frontend hotel selector switches `activeHotelId` and reloads data | UI | Human | P0 |
| T5 | Rooms from Hotel A are not visible when Hotel B is selected | UI | Both | P0 |

### 4.2 RBAC (Role-Based Access Control)

| # | Test Case | Type | Executor | Priority |
|---|---|---|---|---|
| RBAC1 | VIEWER: can read all data, cannot create/update/delete | API | Antigravity | P0 |
| RBAC2 | FRONT_DESK: can manage reservations, guests; cannot manage users | API | Antigravity | P0 |
| RBAC3 | HOUSEKEEPING: can update room cleaning status only | API | Antigravity | P0 |
| RBAC4 | MAINTENANCE: can create/update maintenance requests | API | Antigravity | P0 |
| RBAC5 | ADMIN: full hotel access, user management | API | Antigravity | P0 |
| RBAC6 | SUPER_ADMIN: can create hotels, access all hotels | API | Antigravity | P0 |

### 4.3 Security

| # | Test Case | Type | Executor | Priority |
|---|---|---|---|---|
| S1 | Unauthenticated requests → 401 on all protected routes | API | Antigravity | P0 |
| S2 | JWT expires after 15 min (configurable) | API | Antigravity | P1 |
| S3 | Refresh token rotation works | API | Antigravity | P1 |
| S4 | `ALLOW_DEFAULT_HOTEL` is false in production | API | Antigravity | P0 |

---

## 5. Execution Strategy

### Phase 1 — Smoke Tests (P0 only) — *Day 1*

Run by: **Antigravity (API) + Human (UI)**

Focus: Login, create guest, create reservation, check-in, check-out, invoice auto-gen, dashboard loads, tenancy isolation, RBAC basics.

**Total: ~25 test cases**

### Phase 2 — Functional Tests (P0 + P1) — *Days 2–3*

Run by: **Both**

Add: CRUD for all entities, search/filter, housekeeping flows, maintenance flows, expense flows, audit log verification, notification delivery, token refresh, password change.

**Total: ~55 test cases**

### Phase 3 — Edge Cases & Integration (all priorities) — *Days 4–5*

Run by: **Both**

Add: QloApps sync, merge guests, double room flows, CSV exports, PDF download, calendar view, occupancy forecast validation.

**Total: ~75 test cases**

---

## 6. Automation Recommendations (for Antigravity)

### Backend API Tests (supertest + vitest)

Create test files matching backend service structure:

```
backend/src/services/auth/__tests__/auth_e2e.test.ts
backend/src/services/guests/__tests__/guests_e2e.test.ts
backend/src/services/rooms/__tests__/rooms_e2e.test.ts
backend/src/services/reservations/__tests__/reservations_e2e.test.ts
backend/src/services/check_ins/__tests__/check_ins_e2e.test.ts
backend/src/services/invoices/__tests__/invoices_e2e.test.ts
backend/src/services/expenses/__tests__/expenses_e2e.test.ts
backend/src/services/maintenance/__tests__/maintenance_e2e.test.ts
backend/src/services/reports/__tests__/reports_e2e.test.ts
backend/src/services/audit/__tests__/audit_e2e.test.ts
backend/src/services/notifications/__tests__/notifications_e2e.test.ts
```

**Run command:**
```bash
# Unit tests only (mocked DB — fast, no Docker needed)
cd backend && npm run test:unit

# E2E/integration tests (requires running Docker stack)
cd backend && npm run test:e2e

# All tests
cd backend && npm run test:all
```

### Browser UI Tests (Antigravity browser subagent)

For each P0 UI test:
1. Navigate to login page
2. Authenticate
3. Perform the test scenario
4. Capture screenshot as evidence

---

## 7. Test Reporting

Each test execution should produce:
- **Pass/Fail** status per test case
- **Screenshots** for UI tests
- **API response bodies** for API tests
- **Timestamp** of execution
- **Environment** (dev/staging/prod)

---

## 8. Known Gaps (Not Testable Yet)

These USE_CASES features have no implementation to test:

| Gap | UC | Status |
|---|---|---|
| Guest merge UI | UC-106 | API exists, no frontend workflow |
| Housekeeping schedule view | UC-506 | Missing |
| QloApps conflict resolution UI | UC-1005 | API only |
| QloApps sync logs UI | UC-1006 | API only |
| Advanced occupancy forecast model | UC-808 | Partial — chart exists, model depth unclear |

---

*End of testing plan.*
