# Research: Backend and documentation alignment

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15  
**Revision**: 2026-04-15 — notifications server-side; **docs-as-normative-intent** (prefer correcting **code** to match docs).

## R0 — Documentation authority (default resolution of conflicts)

**Decision**: Treat **`docs/USE_CASES.md`** and linked core docs as the **normative description of product intent**. When implementation disagrees, **change code** (and contracts) to match unless the business **explicitly** revises the documentation in the same release.

**Rationale**: Stakeholders asked to prefer docs over code for correctness and actual intent.

**Alternatives considered**:

- Default to editing docs to match existing code — rejected for this program of work.

## R1 — Audit logs and VIEWER role

**Decision**: **`docs/USE_CASES.md`** (UC-901) grants **Viewer** audit access. Extend `GET /audit-logs` and `GET /audit-logs/:id` **`requireRole`** to include **`VIEWER`** (read-only).

**Rationale**: Code alignment to doc (R0).

**Alternatives considered**:

- Narrow USE_CASES — only if explicit product decision.

## R2 — Expenses and FRONT_DESK

**Decision**: Align routes with **USE_CASES** §8: **remove `FRONT_DESK`** from expense **create/update**; verify **GET** actors against the same tables.

**Rationale**: Code alignment to doc (R0).

## R3 — Password reset vs change password (FR-002)

**Decision**:

- **UC-005 Change password**: Implement authenticated **change-password** endpoint; bcrypt + audit.
- **UC-004 Reset password**: **Implement** a secure reset flow consistent with USE_CASES—typically **token table + time-limited token + out-of-band delivery stub** (configurable mail in production). If email is not wired in a given environment, document **operator-assisted** reset as a temporary exception only if explicitly approved in docs; **default path** is still to implement the API and persistence so the product matches the doc.

**Rationale**: R0 removes “defer in USE_CASES” as the default for High/Medium auth UCs; minimal viable reset = stored token + `POST /auth/reset-request` + `POST /auth/reset-confirm` (exact paths in contract), with pluggable notifier.

**Alternatives considered**:

- Doc-only defer for UC-004 — rejected under revised policy unless formally amended.

## R4 — CORS and untrusted origins (FR-010)

**Decision**: **Production**: allowlist via env (**`CORS_ORIGIN`** / **`CORS_ORIGINS`**); no `*` for browser-facing operational APIs. **Non-production**: permissive allowed and documented.

**Rationale**: Match security NFRs in USE_CASES; code follows documented posture.

## R5 — Guest merge (UC-106)

**Decision**: Implement **operator merge** in the API: transactional **reassign** of dependent rows from **source** guest to **target** guest within `hotel_id`, then **deactivate or delete** source per schema rules; **audit** the merge. Roles: Admin, Manager per USE_CASES.

**Rationale**: R0; doc promises merge path.

**Alternatives considered**:

- Documentation-only deferral — rejected unless explicit product decision amends USE_CASES.

## R6 — Exports and invoice PDF (FR-006)

**Decision**: Implement **minimal** capabilities that satisfy the documented use cases: e.g. **CSV (or JSON) export** for reports and audit where UC-806/UC-903 apply, and **downloadable invoice document** (PDF or agreed single format) for UC-407—keeping dependencies lean (one PDF approach, streaming export).

**Rationale**: Docs state intent; code must catch up rather than weakening the doc silently.

## R7 — Notifications (FR-005) — **server-side**

**Decision**:

1. **Persistence**: New **`notifications`** table: `id`, `hotel_id`, `user_id` (recipient), `type`, `title`, `body` (or `payload` JSON), `read_at` nullable, `created_at`, optional `entity_type` / `entity_id` for deep links; index `(user_id, hotel_id, read_at, created_at)`.
2. **API** (property-scoped, authenticated): `GET /notifications` (list, filter unread), `PATCH /notifications/:id/read` (and optional bulk read); roles per UC-1101–1102 (all authenticated users for their hotel).
3. **Emission**: On relevant domain events, insert rows—at minimum: **check-in / check-out day reminders** (scheduled job or computed on read is **not** sufficient for “server-side”; prefer **write on event** or **idempotent daily job** that inserts missing reminders), **maintenance** create/assign, **housekeeping** dirty/clean alerts as in USE_CASES. Start with **event hooks** in existing `check_ins`, `maintenance`, `rooms` housekeeping paths; add a small **notifications_service** helper to avoid duplication.
4. **Frontend**: May keep derived badges briefly, but **inbox** MUST load from API.

**Rationale**: User requirement: notifications **must** be server-side; matches UC-1101–1106 intent.

**Alternatives considered**:

- Client-only derivation — rejected.

## R8 — QloApps capabilities classification (FR-004)

**Decision**: Single **normative table** in gap report + pointer in ARCHITECTURE. **Docs describe actual delivery** (UI vs API-only). Where UI lags, **either** add minimal UI **or** amend USE_CASES with explicit stakeholder sign-off—**not** silent gap.

**Rationale**: R0; honest classification, code or doc moves deliberately.

## R9 — Check-out and invoice failure narrative

**Decision**: **Documentation** must describe **actual** ordering (checkout state vs invoice insert). If product behavior is wrong relative to USE_CASES expectations, **prefer fixing code** (e.g. transactional boundary review) **or** explicit doc amendment—per R0.

---

## Appendix: Known code references (implementation hints)

| Topic | Location |
|-------|----------|
| Audit roles | `backend/src/services/audit/audit_routes.ts` |
| Expense roles | `backend/src/services/expenses/expenses_routes.ts` |
| Auth surface | `backend/src/services/auth/auth_routes.ts`, `auth_controller.ts` |
| CORS | `backend/src/app.ts` |
| Check-out / invoice | `backend/src/services/check_ins/check_ins_service.ts` |
| New | `backend/src/services/notifications/` (planned), migrations for `notifications` (+ password reset tokens if UC-004) |
