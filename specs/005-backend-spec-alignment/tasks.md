# Tasks: Backend and documentation alignment

**Input**: Design documents from `/home/abdallah/Projects/freelance/hotelmanangement/specs/005-backend-spec-alignment/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/doc-and-rbac-alignment.md](./contracts/doc-and-rbac-alignment.md), [contracts/notifications-api.md](./contracts/notifications-api.md), [quickstart.md](./quickstart.md)

**Tests**: Not mandated as TDD; include focused test updates where noted for RBAC, auth, merge, and notifications.

**Organization**: Phases follow user story priorities from [spec.md](./spec.md); foundational work blocks story phases that need schema or the notifications module.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no ordering dependency on incomplete sibling)
- **[USn]**: User Story `n` from spec (Setup, Foundational, and Polish omit story labels)

## Path Conventions

- Backend: `backend/src/`, `backend/docs/`
- Docs: `docs/`
- Contracts: `specs/001-phase0-baseline-spec/contracts/core-api.md`
- Frontend: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and configuration stubs so CORS and mail-related auth can be configured per [research.md](./research.md) R4 and R3.

- [x] T001 Document `CORS_ORIGIN`, `CORS_ORIGINS`, and optional SMTP or mail-related variables in `backend/.env.example` with comments matching [plan.md](./plan.md) Wave F.
- [x] T002 [P] Align root `.env.example` (if it references API/CORS) with the same CORS variable names documented in `backend/.env.example`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrations and **notifications** module shell—**required** before User Story 3 emitters and before integrating notification reads on the frontend.

**Checkpoint**: Migrations apply cleanly; `GET /api/v1/notifications` returns an empty list for a valid user+hotel.

- [x] T003 [P] Add Knex migration creating `notifications` table per [data-model.md](./data-model.md) under `backend/src/database/migrations/`.
- [x] T004 [P] Add Knex migration creating `password_reset_tokens` table under `backend/src/database/migrations/`.
- [x] T005 Describe `notifications` and `password_reset_tokens` in `backend/docs/DATABASE.md`.
- [x] T006 Implement `createNotification`, `listNotificationsForUser`, `markRead`, optional `markAllRead` in `backend/src/services/notifications/notifications_service.ts` (Knex, `hotel_id` + `user_id` scoping, pagination).
- [x] T007 Implement HTTP handlers in `backend/src/services/notifications/notifications_controller.ts` and wire `backend/src/services/notifications/notifications_routes.ts` per [contracts/notifications-api.md](./contracts/notifications-api.md) (`authenticateToken`, `hotelContext`, recipient = `req.user.id`).
- [x] T008 Mount notifications router under `/v1/notifications` in `backend/src/routes.ts` (consistent with existing `/api` prefix in `backend/src/app.ts`).

---

## Phase 3: User Story 1 — Trustworthy role-based access (Priority: P1)

**Goal**: RBAC matches `docs/USE_CASES.md` for audit visibility and expense mutation roles ([spec.md](./spec.md) US1, FR-001).

**Independent Test**: VIEWER can `GET` audit logs with valid `X-Hotel-Id`; FRONT_DESK receives **403** on expense create/update; MANAGER succeeds on expense create.

- [x] T009 [US1] Add `VIEWER` to `requireRole` for `GET /audit-logs` and `GET /audit-logs/:id` in `backend/src/services/audit/audit_routes.ts`.
- [x] T010 [US1] Remove `FRONT_DESK` from expense mutating routes and align `GET` expense routes with `docs/USE_CASES.md` actor tables in `backend/src/services/expenses/expenses_routes.ts`.
- [x] T011 [US1] Extend `backend/src/services/audit/__tests__/audit_tenancy.test.ts` (or add adjacent test file) to assert VIEWER read access and hotel scoping for audit list/detail.
- [x] T012 [US1] Add or update expense RBAC tests under `backend/src/services/expenses/` verifying FRONT_DESK denial on POST/PUT and allowed roles per doc.

---

## Phase 4: User Story 2 — Authentication promises match product (Priority: P1)

**Goal**: Change password and password reset flows exist and match `docs/USE_CASES.md` UC-004/UC-005 ([spec.md](./spec.md) US2, FR-002).

**Independent Test**: Authenticated user changes password; reset request issues token; reset confirm updates hash; login works with new password; tokens are one-time and expire.

- [x] T013 [US2] Add request/response types for change-password and reset flows in `backend/src/services/auth/auth_types.ts`.
- [x] T014 [US2] Implement `changePasswordHandler` (verify current password, bcrypt hash, audit) in `backend/src/services/auth/auth_controller.ts`.
- [x] T015 [US2] Implement `forgotPasswordHandler` and `resetPasswordHandler` using hashed tokens and `password_reset_tokens` table in `backend/src/services/auth/auth_controller.ts`.
- [x] T016 [US2] Register `POST /change-password`, `POST /forgot-password`, `POST /reset-password` in `backend/src/services/auth/auth_routes.ts` with correct public vs authenticated middleware.
- [x] T017 [P] [US2] Add pluggable notifier (log in dev, optional SMTP when configured) in `backend/src/services/auth/auth_notifier.ts` and call from forgot-password path.
- [ ] T018 [US2] Add tests under `backend/src/services/users/__tests__/` or new `backend/src/services/auth/__tests__/` covering change-password, reset token expiry, and single-use behavior.

---

## Phase 5: User Story 3 — Integration clarity and server notifications (Priority: P2)

**Goal**: Operational events persist notifications for eligible users; QloApps and architecture docs classify UI vs API honestly ([spec.md](./spec.md) US3, FR-004, FR-005).

**Independent Test**: After a qualifying domain action, recipient sees new row via `GET /api/v1/notifications`; mark-read works; gap report and ARCHITECTURE describe persisted notifications and QloApps delivery mode consistently.

- [x] T019 [US3] Invoke `notifications_service` from check-in and check-out paths in `backend/src/services/check_ins/check_ins_service.ts` for reminders/alerts per `docs/USE_CASES.md` UC-1103–1106 (use stable idempotency keys in `payload` where duplicates are likely).
- [x] T020 [P] [US3] Invoke `notifications_service` from maintenance create/update flows in `backend/src/services/maintenance/maintenance_controller.ts` (or extracted service file if present).
- [x] T021 [P] [US3] Invoke `notifications_service` from housekeeping-related updates in `backend/src/services/rooms/rooms_controller.ts` when status changes warrant UC-1106-style alerts.
- [x] T022 [P] [US3] Add classification table (UI vs API-only vs planned) for QloApps capabilities in `docs/PMS_USE_CASE_QLOAPPS_GAP_REPORT.md` consistent with actual `frontend/src/` coverage.
- [x] T023 [P] [US3] Update `docs/ARCHITECTURE.md` with persisted notifications flow, emitter locations, and production CORS allowlist intent.

---

## Phase 6: User Story 4 — Accurate operational edge cases (Priority: P2)

**Goal**: Check-in/out and invoice failure narrative matches product behavior; optional code fix if docs require stronger guarantees ([spec.md](./spec.md) US4, FR-003, research R9).

**Independent Test**: `docs/CHECK_INS_API_DOCUMENTATION.md` matches `hotel_date` usage and checkout-vs-invoice ordering; stakeholders sign off on described failure handling.

- [x] T024 [US4] Update `docs/CHECK_INS_API_DOCUMENTATION.md` with hotel-local dates, checkout transaction boundaries, and invoice failure follow-up consistent with `backend/src/services/check_ins/check_ins_service.ts` and `backend/src/utils/hotel_date.ts`.
- [x] T025 [US4] Reconcile checkout+invoice transaction boundaries in `backend/src/services/check_ins/check_ins_service.ts` with `docs/USE_CASES.md` UC-306; adjust code **or** amend use case explicitly in the same PR per [research.md](./research.md) R0.
- [x] T026 [US4] Align narrative in `docs/USE_CASES.md` §UC-306 with the chosen behavior from T025 if wording still contradicts implementation.

---

## Phase 7: User Story 5 — Documentation integrity (Priority: P3)

**Goal**: Indexed docs and USE_CASES appendix links resolve ([spec.md](./spec.md) US5, FR-008).

**Independent Test**: No broken links from `docs/DOCUMENTATION_INDEX.md` or USE_CASES appendix to database/architecture artifacts.

- [x] T027 [US5] Fix **Related Documents** database link in `docs/USE_CASES.md` appendix to point at `backend/docs/DATABASE.md` (repo-relative path that works from `docs/`).
- [x] T028 [P] [US5] Ensure `docs/DOCUMENTATION_INDEX.md` lists the canonical database doc path matching `backend/docs/DATABASE.md`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: FR-006 exports/PDF, FR-007 guest merge, FR-010 CORS implementation, contract merge, frontend inbox, final verification.

- [x] T029 Implement transactional guest merge endpoint (Admin/Manager, same `hotel_id`) with FK reassignment and audit in `backend/src/services/guests/guests_controller.ts` and `backend/src/services/guests/guests_routes.ts` per [data-model.md](./data-model.md).
- [ ] T030 Add merge tests and audit assertions under `backend/src/services/guests/` (new or existing `__tests__` directory).
- [x] T031 Add minimal invoice PDF download (choose one small PDF dependency) in `backend/src/services/invoices/invoices_controller.ts` and `backend/src/services/invoices/invoices_routes.ts` per UC-407.
- [x] T032 [P] Add audit log CSV (or agreed export format) endpoint in `backend/src/services/audit/audit_controller.ts` and `backend/src/services/audit/audit_routes.ts` per UC-903.
- [x] T033 [P] Add report export endpoint in `backend/src/services/reports/reports_controller.ts` and `backend/src/services/reports/reports_routes.ts` per UC-806.
- [x] T034 Implement production CORS allowlist using `CORS_ORIGIN` / `CORS_ORIGINS` in `backend/src/app.ts` while preserving developer ergonomics when `NODE_ENV !== 'production'`.
- [x] T035 Merge normative rules from `specs/005-backend-spec-alignment/contracts/doc-and-rbac-alignment.md` and `specs/005-backend-spec-alignment/contracts/notifications-api.md` into `specs/001-phase0-baseline-spec/contracts/core-api.md` (or add explicit cross-links plus duplicated normative tables—pick one strategy and apply consistently).
- [x] T036 [P] Update `frontend/src/utils/api.js` and `frontend/src/components/Notifications.jsx` (and related stores/pages) to load and mark-read notifications via `/api/v1/notifications` instead of client-only derivation.
- [x] T037 [P] Update `docs/USE_CASES.md` §12 Notifications to state notifications are **server-persisted** and list API-backed view/mark-read if wording still implies client-only delivery.
- [x] T038 Run `cd backend && npm test` and execute manual checks in `specs/005-backend-spec-alignment/quickstart.md`; record any gaps as follow-up issues.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → no prerequisites.
- **Phase 2** → after Phase 1; **blocks** Phase 5 (emitters) and **blocks** T036 until API exists.
- **Phase 3 (US1)** → after Phase 2 optional for audit/expense-only work; can run **in parallel with** Phase 2 once repo builds, but recommend after Phase 2 if same branch to reduce migration churn.
- **Phase 4 (US2)** → after T004 (reset tokens); can overlap with Phase 3 after T004 applied.
- **Phase 5 (US3)** → **after Phase 2 complete** (T003–T008).
- **Phase 6 (US4)** → after Phase 2; independent of US3.
- **Phase 7 (US5)** → can run anytime; often batched with Polish doc tasks.
- **Phase 8** → after Phases 2–4 for merge/CORS; PDF/export after RBAC stable; T035–T038 last.

### User Story Completion Order (suggested)

1. **US1** (T009–T012) — MVP security/trust baseline.
2. **US2** (T013–T018) — auth parity.
3. **US3** (T019–T023) — notifications + integration docs.
4. **US4** (T024–T026) — operational truthfulness.
5. **US5** (T027–T028) — link integrity.
6. **Polish** (T029–T038) — merge, exports, CORS, contracts, frontend, verification.

### Parallel Opportunities

- **T003** and **T004** (migrations) in parallel.
- **T017** and core auth handler tasks after T015 scaffold—parallel only if different files (notifier vs controller split).
- **T020**, **T021**, **T022**, **T023** in parallel after T019 or independently once T008 done.
- **T032** and **T033** in parallel.
- **T036** and **T037** in parallel after T008 and notification semantics stable.

### Parallel Example: User Story 3 (after Phase 2)

```text
T020 maintenance → notifications in backend/src/services/maintenance/maintenance_controller.ts
T021 housekeeping → notifications in backend/src/services/rooms/rooms_controller.ts
T022 docs/PMS_USE_CASE_QLOAPPS_GAP_REPORT.md classification table
T023 docs/ARCHITECTURE.md notifications + CORS notes
```

---

## Implementation Strategy

### MVP First (User Stories 1–2 + Foundational)

1. Complete Phase 2 (T003–T008) minimally so notifications API exists.
2. Complete Phase 3 (US1) and Phase 4 (US2).
3. **STOP and VALIDATE** with role matrix and auth flows from [quickstart.md](./quickstart.md).

### Incremental Delivery

1. Add Phase 5 (US3) emitters + doc classification.
2. Add Phase 6–7 (US4–US5) documentation accuracy and links.
3. Finish Phase 8 (merge, exports, PDF, CORS, contracts, frontend, full quickstart).

---

## Notes

- Prefer **code changes to match `docs/USE_CASES.md`** per [research.md](./research.md) R0; doc edits only for explicit policy changes in the same release.
- Keep notification inserts **idempotent** where the same cron/event might fire twice.
- Rate-limit or throttle `POST /forgot-password` to reduce abuse (middleware or simple store)—implement in T015/T016 scope or follow-up if timeboxed.
- **T038 note**: `npm test` and `npm run build` verified in backend; manual steps in [quickstart.md](./quickstart.md) are still recommended before release.
- **Open follow-ups**: **T018** (auth flow integration tests), **T030** (guest merge tests).
