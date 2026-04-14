# Research: Reservation to Check-out Lifecycle

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## 1. As-built backend lifecycle

### Decision

The **canonical** implementation path for check-in, check-out, and in-stay room change is the **Check-ins** module: `POST /api/v1/reservations/:id/check-in`, `PATCH /api/v1/check-ins/:id/checkout`, `POST /api/v1/check-ins/:id/change-room` (see `check_ins_routes.ts`). `check_ins_service.ts` updates `check_ins`, `reservations` (status, `checkin_id`), `rooms`, `housekeeping`, and queues QloApps hooks non-blockingly.

### Rationale

`reservations_controller` documents legacy behavior: updating `reservations.status` directly still mutates room/housekeeping but is **deprecated** in favor of the Check-ins API.

### Alternatives considered

- **Check-in/out only via reservation PATCH** — Rejected; team already split `check_ins` / `room_assignments` for audit and room moves.

---

## 2. Reservation status enum vs spec

### Decision

Database constraint `check_reservations_status` (from `20251226000005_create_reservations.ts`) allows: `Confirmed`, `Checked-in`, `Checked-out`, `Cancelled`. **No-show** is **not** in the DB today. Spec requires **No-show** as a first-class terminal state from **Confirmed**.

### Rationale

Spec clarification session 2026-04-15 (Option B). Implementation requires a **migration** to extend the CHECK constraint (and application enums) with `No-show`, plus API/UI to set it with the same inventory-release semantics as cancel where applicable.

### Alternatives considered

- **Map No-show to Cancelled** — Rejected; spec distinguishes operational meaning for reporting.

---

## 3. Check-in / check-out date rules (UC-305 / UC-306)

### Decision

`checkInGuest` enforces `reservation.status === 'Confirmed'` and no duplicate `checkin_id`; it does **not** currently enforce “check-in date is today or earlier” or “check-out date is today or earlier” at the service layer in the excerpt reviewed. Spec FR-001 / FR-002 require those guards.

### Rationale

Align service validation with property **timezone** (hotel settings) and calendar **date** comparison against `reservations.check_in` / `check_out`.

### Alternatives considered

- **UI-only validation** — Rejected; API must enforce for security and integrations.

---

## 4. Invoice on check-out (UC-409) and custom amount (FR-004, FR-008, FR-014)

### Decision

`checkOutGuest` (as reviewed) updates check-in, reservation, room, housekeeping — **no invoice insert**. Spec requires invoice on check-out (continue check-out if invoice fails), default amount = reservation-calculated total, staff **custom total**, and **audit** when final ≠ default. `invoices` table has a single `amount` (no `calculated_amount` / override metadata).

### Rationale

Add transactional or post-step **invoice creation** in check-out flow (or dedicated service callable from controller), accept **optional `amount`** on check-out request body, defaulting from `reservations.total_amount` or recomputed nights × rate; persist audit via existing `audit` utilities and/or new nullable columns (`calculated_amount`, `amount_override_by`, `amount_override_at`) if product wants queryable reconciliation without parsing audit JSON.

### Alternatives considered

- **Manual invoice only after check-out** — Rejected; spec mandates default auto invoice at check-out.

---

## 5. In-stay room move

### Decision

`changeRoom` already implements room reassignment with `room_assignments` audit, old room → Cleaning/Dirty, new room → Occupied. Spec FR-013 also requires validating target room **for the remainder of the stay** (through scheduled check-out) against overlapping reservations — verify `changeRoom` and/or add overlap query for **new_room_id** over `[today, reservation.check_out)` or equivalent.

### Rationale

Prevents double-booking the new room for overlapping nights.

### Alternatives considered

- **Out of scope** — Rejected by clarification Option B.

---

## 6. Cancelled / No-show and inventory

### Decision

Cancel via `reservations` update likely sets **Cancelled**; ensure **room** and availability views exclude cancelled/no-show overlaps consistently. **No-show** path must release **reserved_room** / `room_id` nights same as cancel (implementation detail in service layer after migration).

### Rationale

Spec terminal states must not leave rooms stuck **Occupied** without an active check-in.

---

## 7. Frontend coherence

### Decision

Verify `frontend` reservation and check-out UI uses Check-ins API, exposes **cancel** / **no-show** (after API exists), check-out **amount** field (default + override), and does not rely solely on legacy reservation status PATCH for check-in/out.

### Rationale

Single operational path reduces state drift between `check_ins.actual_room_id` and `reservations.room_id` / `reserved_room_id`.

### Alternatives considered

- **Backend-only change** — Insufficient; spec acceptance is end-to-end for staff workflows.

---

## 8. Documentation updates (Principle IV)

### Decision

Same milestone updates: `docs/DATABASE_SCHEMA.md`, `docs/ERD.md` if reservation status or invoice columns change; extend `specs/001-phase0-baseline-spec/contracts/core-api.md` or maintain **feature contract** in [contracts/reservation-lifecycle-api.md](./contracts/reservation-lifecycle-api.md) as source for tasks until merged into global contract doc.

### Rationale

Traceability from spec to schema and API.
