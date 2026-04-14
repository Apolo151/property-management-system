# Feature Gap Matrix: Codebase vs USE_CASES

**Reference Requirements**: `docs/USE_CASES.md`  
**Codebase Analyzed**: `frontend/src/pages`, `frontend/src/store`, `backend/src`  
**Date**: 2026-04-14  
**System Scope**: Multi-property hotel management platform (multiple independent hotel tenants)

## Status Legend

- **Implemented**: Requirement behavior exists end-to-end (UI + API/service or system process)
- **Partial**: Core behavior exists but scope, reliability, security, or UX is incomplete
- **Missing**: Requirement not found or not operationally usable in current code

## Module Coverage Summary

| Module (USE_CASES) | Coverage | Notes |
|---|---|---|
| 1. Authentication & Authorization | Partial | Login/refresh/roles exist; reset/change password flows missing from UI/use-case completion |
| 2. Guest Management | Partial | CRUD/search/history/notes exist; duplicate merge workflow missing |
| 3. Room Management | Partial | CRUD/status/availability mostly present; rates/features/out-of-service depth incomplete |
| 4. Reservation Management | Partial | Create/search/calendar/check-in/out present; edit/cancel/date-modify/second-guest coverage partial |
| 5. Invoice & Payment Management | Partial | Invoice/payment core exists; PDF/history/auto-checkout invoice reliability not fully proven |
| 6. Housekeeping Management | Partial | Status updates and assignment exist; schedule/alerts/workflow depth missing |
| 7. Maintenance Management | Partial | Create/view/update/priority/repaired present; tenant-scoping and history depth need hardening |
| 8. Expense Management | Implemented | Core create/view/update/delete/category/filter/report needs appear covered |
| 9. Reporting & Analytics | Partial | Dashboard and exports exist; advanced occupancy forecast/cancellation analysis depth partial |
| 10. Audit & Compliance | Partial | View/search/filter largely present; export/user-activity granularity and tenant filtering need hardening |
| 11. Beds24 Integration | Missing/Partial | Requirement names Beds24, implementation targets QloApps with partial sync/TODOs |
| 12. Notifications | Partial | Notification UI exists; reminder/alert automation use cases not fully evidenced |

## Feature Gap Matrix (Prioritized)

| Use Case ID | Requirement | Current Status | Evidence (Current Code) | Gap / Root Cause | Recommended Phase |
|---|---|---|---|---|---|
| UC-004 | Reset Password | Missing | `frontend/src/pages/LoginPage.jsx`, `backend/src/services/auth/auth_routes.ts` | No complete reset-password user flow (request/reset token + reset UI/API lifecycle) evident | Phase 2 |
| UC-005 | Change Password | Partial | `frontend/src/store/authStore.js`, `backend/src/services/auth` | Backend/auth utilities exist but no clear user-facing change-password journey in pages | Phase 2 |
| UC-006 | Manage User Roles | Partial | `frontend/src/pages/SettingsPage.jsx`, `backend/src/services/users/users_routes.ts` | Users routes have auth-wiring risk (`requireRole` without clear `authenticateToken`) causing reliability/security gap | Phase 2 + Phase 4 hardening |
| UC-106 | Merge Duplicate Guest Records | Missing | `frontend/src/pages/GuestsPage.jsx`, `backend/src/services/guests` | No merge workflow detected in guest UI/API | Phase 2 |
| UC-207 | Set Room Rates | Partial | `frontend/src/pages/RoomTypesPage.jsx`, `backend/src/services/room_types` | Base pricing exists but dedicated rate-management flow is limited vs use-case intent | Phase 2/3 |
| UC-208 | Add Room Features | Partial | `frontend/src/pages/RoomsPage.jsx`, `backend/src/services/rooms` | Room attributes present, but explicit room-features management workflow is limited | Phase 2 |
| UC-209 | Mark Room Out of Service | Partial | `frontend/src/pages/RoomsPage.jsx`, `backend/src/services/rooms` | Status model supports control, but explicit out-of-service lifecycle/planning is weak | Phase 2 |
| UC-303 | Update Reservation | Partial | `frontend/src/pages/ReservationsPage.jsx`, `backend/src/services/reservations/reservations_controller.ts` | APIs exist, but rich edit flow and lifecycle consistency remain incomplete/legacy-mixed | Phase 2 |
| UC-304 | Cancel Reservation | Partial | `frontend/src/store/reservationsStore.js`, `backend/src/services/reservations` | Status transitions exist; explicit cancellation UX/rules and reporting consistency are limited | Phase 2 |
| UC-311 | Modify Reservation Dates | Partial | `frontend/src/pages/ReservationsPage.jsx`, `backend/src/services/reservations` | Partial support, but conflict-safe dedicated modification flow not clearly complete | Phase 2 |
| UC-312 | Add Second Guest to Reservation | Partial | `frontend/src/pages/ReservationsPage.jsx` | Mentioned in booking flow context, but full rule validation and lifecycle handling are not clearly complete | Phase 2 |
| UC-407 | Generate Invoice PDF | Missing | `frontend/src/pages/InvoicesPage.jsx`, `backend/src/services/invoices` | No PDF generation/export flow evidenced for invoices | Phase 2 |
| UC-408 | View Payment History | Partial | `frontend/src/pages/InvoicesPage.jsx`, `backend/src/services/invoices` | Mark-paid and status exist, but explicit historical payment ledger view is limited | Phase 2 |
| UC-409 | Auto-generate Invoice on Check-out | Partial | `backend/src/services/check_ins/check_ins_service.ts`, `docs/USE_CASES.md` | Checkout lifecycle exists; guaranteed invoice auto-generation path and failure handling not fully validated end-to-end | Phase 2 |
| UC-506 | View Housekeeping Schedule | Missing | `frontend/src/pages/RoomsPage.jsx` | Housekeeping statuses exist; no explicit schedule/calendar workflow detected | Phase 2 |
| UC-507 | Track Last Cleaned Date | Partial | `frontend/src/pages/RoomsPage.jsx`, `backend/src/services/rooms` | Last-cleaned appears surfaced in some places; consistency/history depth unclear | Phase 2 |
| UC-607 | View Maintenance History | Partial | `frontend/src/pages/MaintenancePage.jsx`, `backend/src/services/maintenance/maintenance_controller.ts` | List/history basics exist, but tenant filtering and long-term history/reporting robustness need work | Phase 2 + Phase 4 hardening |
| UC-807 | View Cancellation Rate | Partial | `frontend/src/pages/DashboardPage.jsx`, `backend/src/services/reports/reports_controller.ts` | Dashboard metrics exist; explicit cancellation-rate accuracy/traceability requirements need validation | Phase 2 |
| UC-808 | View Occupancy Forecast | Partial | `frontend/src/pages/DashboardPage.jsx`, `backend/src/services/reports` | Forecast visualization exists, but forecasting model depth/data confidence unclear | Phase 2 |
| UC-903 | Export Audit Logs | Partial | `frontend/src/pages/AuditLogsPage.jsx`, `backend/src/services/audit` | Audit viewing exists; export capability and scoped controls need confirmation/hardening | Phase 2/4 |
| UC-905 | View User Activity | Partial | `frontend/src/pages/AuditLogsPage.jsx`, `backend/src/services/audit/audit_controller.ts` | General logs available, but dedicated user activity reporting and tenant-safe filtering are limited | Phase 2 + Phase 4 hardening |
| UC-1001..UC-1008 | Beds24 Integration Suite | Missing/Partial | `backend/src/services/qloapps/*`, `backend/src/integrations/qloapps/*`, `frontend/src/pages/SettingsPage.jsx` | Requirement targets Beds24, current implementation targets QloApps; plus sync conflict/health/rate/availability TODOs remain | Phase 3 |
| UC-1101..UC-1106 | Notifications Suite | Partial | `frontend/src/components/Notifications.jsx`, `backend/src` | Notification surface exists, but automated reminder/alert rules in use cases are not fully evidenced | Phase 2 |

## High-Confidence Implemented Areas

- Authentication login/refresh baseline: `backend/src/services/auth/*`, `frontend/src/pages/LoginPage.jsx`
- Core reservation/check-in/room-change lifecycle: `backend/src/services/check_ins/*`, `frontend/src/pages/CheckInsPage.jsx`
- Guests, rooms, room types, invoices, expenses CRUD foundations:
  - `backend/src/services/{guests,rooms,room_types,invoices,expenses}/*`
  - `frontend/src/pages/{GuestsPage,RoomsPage,RoomTypesPage,InvoicesPage,ExpensesPage}.jsx`
- Maintenance request lifecycle baseline: `backend/src/services/maintenance/*`, `frontend/src/pages/MaintenancePage.jsx`
- Reporting/dashboard baseline: `backend/src/services/reports/*`, `frontend/src/pages/{DashboardPage,ReportsPage}.jsx`

## Cross-Cutting Risks Identified During Comparison

- **Tenant isolation inconsistencies (Partial)**:
  - Maintenance and audit read paths need stricter hotel scoping validation.
- **Security hardening debt (Partial)**:
  - User route auth-wiring inconsistency; permissive defaults should be tightened before production.
- **Use-case drift in external integration (Resolved)**:
  - `USE_CASES.md` previously specified Beds24; updated to QloApps. Sync implementation gaps remain (Phase 3).
- **Legacy/overlapping lifecycle handling (Medium)**:
  - Reservation and check-in responsibilities partially overlap, raising state-transition risk.

## Recommended Next Actions

1. ✅ Updated `docs/USE_CASES.md`, `docs/DATABASE_SCHEMA.md`, `docs/ERD.md` to reflect multi-property design and QloApps (was Beds24).
2. Convert the matrix rows into Phase 2/3 backlog items with acceptance tests per use case.
3. Add a Phase 4 security hardening track for tenant isolation and auth middleware consistency.
4. Add evidence-based verification checklist for each high-priority partial/missing use case.
