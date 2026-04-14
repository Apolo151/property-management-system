# Feature Specification: Reservation to Check-out Lifecycle

**Feature Branch**: `[002-reservation-checkout-lifecycle]`  
**Created**: 2026-04-15  
**Status**: Draft  
**Input**: User description: "Define the 'Reservation to Check-out' lifecycle based on Phase 2 scope in IMPLEMENTATION_PHASE_PLAN.md, using docs/USE_CASES.md for business rules."

## Clarifications

### Session 2026-04-15

- Q: Should **Cancelled** and **No-show** be first-class reservation states with explicit transition rules? → A: **Yes (Option B)** — Add **Cancelled** and **No-show** as named states with documented transitions from **Confirmed**; align with common PMS practice and UC-304.
- Q: Should **in-stay room move** (change assigned physical room while **Checked-in**) be in Phase 2 scope? → A: **Yes (Option B)** — Authorized roles can reassign the guest to another room while **Checked-in**, with room/housekeeping consistency and full audit.
- Q: Invoice structure in Phase 2 (line items vs single amount) and staff override? → A: **Option A** — One **rolled-up total** per invoice (no required line-item breakdown in Phase 2); staff MUST be able to **accept the system-calculated default amount** or **enter a custom invoice total** (check-out flow and manual invoice creation per UC-401); overrides MUST be audit-logged when they differ from the calculated default.

## Business lifecycle overview

This feature defines the **core PMS stay lifecycle** for Phase 2 (non-channel): from a bookable reservation through **check-in** and **check-out** to a **billable outcome**, with room and housekeeping alignment.

**States (reservation)** — derived from `USE_CASES.md` UC-301, UC-305, UC-306, UC-304, plus clarification session 2026-04-15:

| State | Meaning |
|--------|--------|
| **Confirmed** | Stay is booked; guest has not yet been checked in. |
| **Checked-in** | Guest is in-house; room is occupied for this stay. |
| **Checked-out** | Stay ended; room is released to cleaning workflow; invoice is expected (auto). |
| **Cancelled** | Booking was voided before the stay completed; no guest arrival under this reservation. |
| **No-show** | Guest did not check in; scheduled arrival passed without **Checked-in** (staff-marked per property timing policy). |

**Primary transitions** (happy path):

1. **Create reservation** (UC-301): Establishes stay, guest(s), room, dates, total; default path starts in **Confirmed** when the stay is booked; validates availability and dates; may queue channel sync if configured.
2. **Check-in** (UC-305): **Confirmed** → **Checked-in** when check-in date is today or earlier, room is available (or staff explicitly override cleaning warning); room **Occupied**; housekeeping notified and prepared for dirty workflow.
3. **Check-out** (UC-306, UC-409): **Checked-in** → **Checked-out** when check-out date is today or earlier; applies to the **currently assigned** room; room **Cleaning**; housekeeping **Dirty**; **invoice created** with a **single total** defaulting to the reservation-calculated amount, which staff MAY override with a **custom total** before confirming check-out; failure to invoice does not block check-out.

**In-stay operations** (reservation remains **Checked-in**):

3a. **Room move** (clarification 2026-04-15): While **Checked-in**, authorized staff MAY assign the stay to a different physical room for the same property. The former room MUST be released according to housekeeping/room-status rules (e.g., cleaning or serviceable per policy); the new room MUST become occupied for this stay; availability MUST be validated for the new room for the remainder of the stay (through scheduled check-out); audit MUST record old room, new room, actor, and time; optional channel sync when configured. The reservation total is unchanged by a room move alone—rate or room-type differences are reflected at billing time via **custom invoice amount** at check-out or manual invoice (UC-401), if the property chooses.

**Terminal / pre-arrival outcomes** (from **Confirmed** only):

4. **Cancel reservation** (UC-304): **Confirmed** → **Cancelled**; booked room nights return to availability; no check-in or check-out; no auto check-out invoice.
5. **No-show** (operational closure): **Confirmed** → **No-show** when staff record that the guest did not arrive, on or after the scheduled check-in date per property policy; booked nights return to availability; no auto departure invoice. Any penalty or retention fee for no-show, if charged, is handled via manual invoice (UC-401), not the check-out auto-invoice path.

**Supporting transitions** (same Phase 2 scope, same property): update, change dates, second guest, in-stay room move while **Checked-in**, search/detail/calendar (UC-303, UC-309–UC-312, UC-302, UC-307, UC-308); manual invoice and payment completion (UC-401, UC-403–UC-405). **Cancelled** and **No-show** do not receive date changes, room moves, or check-in; corrections are audit-governed exceptions if ever allowed later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete stay from confirmed reservation through check-out (Priority: P1)

Front desk or a manager runs the primary operational path: a reservation exists in **Confirmed** state, the guest arrives on or after the scheduled check-in date, staff checks them in, then on or after the scheduled check-out date staff checks them out. Staff may **move the guest to another room** during the stay while **Checked-in** without ending the reservation. Check-out must produce billing linked to the stay (automatic invoice per business rules) and update room and housekeeping expectations so the property can turn the **currently assigned** room.

**Why this priority**: Phase 2 exit criteria require core operational flows to be stable for **reservation → check-in → check-out → invoice** without depending on the channel manager.

**Independent Test**: Create a reservation for an available room with valid dates, perform check-in, then perform check-out; verify reservation outcome state, room disposition, housekeeping signal, invoice existence, audit trail, and staff notification expectations per use cases.

**Acceptance Scenarios**:

1. **Given** a reservation in **Confirmed** state with check-in date today or in the past and an available room, **When** authorized staff run check-in, **Then** the reservation becomes **Checked-in**, the room becomes occupied, housekeeping is set up for a future dirty state as specified, an audit event is recorded, housekeeping is notified, and (if channel integration is configured for the property) an outbound sync is queued—without blocking success if sync is unavailable.
2. **Given** a reservation in **Checked-in** state with check-out date today or in the past, **When** authorized staff run check-out, **Then** the reservation becomes **Checked-out**, the room moves to a cleaning-oriented state, housekeeping is marked dirty, an invoice is created with a single total (defaulting to the calculated stay amount) linked to the reservation and guest, an audit event is recorded, housekeeping is notified, staff see success with invoice details, and (if configured) channel sync is queued.
3. **Given** the same check-out flow, **When** staff set a **custom invoice total** instead of the default, **Then** the invoice uses that total, the deviation from the calculated default is audit-logged (actor, default, final), and check-out otherwise completes as in the standard scenario.
4. **Given** check-out runs but automatic invoice creation fails, **When** the failure is handled per business rules, **Then** check-out still completes, the failure is logged, and staff can still finish the guest departure without leaving the guest in **Checked-in** state.
5. **Given** a **Checked-in** reservation and a target room that is valid for the stay (available for the remaining nights, same property), **When** authorized staff perform a room move, **Then** the reservation remains **Checked-in**, the stay points to the new room, the previous room is updated for housekeeping/room status per policy, the new room shows occupied, an audit event captures from/to rooms, and (if configured) channel sync may be queued without blocking the move.

**Traceability**: UC-305, UC-306, UC-409; Phase 2 “Core PMS Completion (Non-Channel)” exit criteria; in-stay room move per clarification 2026-04-15 (aligns with housekeeping UC-501–UC-505 and room status UC-204).

---

### User Story 2 - Create and maintain reservations before and during the stay (Priority: P1)

Staff create reservations with validated dates, guest selection, room selection, availability checks, total amount from nights and rate, optional second guest for double occupancy, and an explicit reservation status where relevant. They can update reservations, cancel them when policy allows, change dates with availability re-validation, and add a second guest later.

**Why this priority**: The lifecycle starts with a correct reservation; Phase 2 scope includes resolving lifecycle mismatches across schema, API, and UI.

**Independent Test**: Create reservations with valid and invalid inputs; update, cancel, modify dates, and attach a second guest; verify availability rules, confirmations, and audit logging.

**Acceptance Scenarios**:

1. **Given** an existing guest and a room available for the chosen nights, **When** staff create a reservation with check-out strictly after check-in and required fields, **Then** the system validates dates, checks availability, calculates total from nights and nightly price, allows optional second guest (with confirmation if missing for a double-room intent), persists the reservation, updates availability, records an audit event, and queues channel sync only when integration is configured.
2. **Given** invalid dates or an unavailable room, **When** staff attempt to save, **Then** the system blocks or warns per rules (including optional override with explicit confirmation when the use case allows conflict warning).
3. **Given** a **Confirmed** reservation, **When** staff cancel it per permissions, **Then** the reservation becomes **Cancelled**, room nights are released to availability, check-in and check-out are blocked, and an audit event is recorded (UC-304).
4. **Given** a **Confirmed** reservation past the point where no-show may apply per property policy, **When** staff mark **No-show**, **Then** the reservation becomes **No-show**, nights are released, check-in and check-out are blocked, and an audit event is recorded.
5. **Given** a **Confirmed** reservation, **When** staff update it (dates, room, guests) without cancelling, **Then** availability is recalculated as needed, state remains **Confirmed** unless a transition above applies, and audit events are recorded (UC-303, UC-309–UC-312).

**Traceability**: UC-301, UC-303, UC-304, UC-309, UC-310, UC-311, UC-312.

---

### User Story 3 - Find, open, and schedule views of reservations (Priority: P2)

Staff search and filter reservations and open details; they use calendar-style views where provided to plan arrivals and departures.

**Why this priority**: Operational staff must locate the correct reservation before check-in or check-out; supports UC-307, UC-302, UC-308.

**Independent Test**: Search by guest, room, or date; open a detail view; confirm calendar reflects reservation dates and statuses.

**Acceptance Scenarios**:

1. **Given** many reservations for the property, **When** an authorized user searches with criteria, **Then** matching reservations appear within permission boundaries.
2. **Given** a selected reservation, **When** the user opens details, **Then** they see information needed for check-in/check-out decisions (guests, room, dates, status, amounts as applicable).
3. **Given** calendar access, **When** the user views the reservation calendar, **Then** stays appear in a way that supports planning (aligned with UC-308).

**Traceability**: UC-302, UC-307, UC-308.

---

### User Story 4 - Invoice and payment completion around the stay (Priority: P2)

Beyond invoice creation at check-out, finance-oriented roles create invoices when needed, accept or override the calculated amount, update invoice status, record payments, and mark invoices paid with payment method—so the stay’s financial record can be completed and reported. Phase 2 uses a **single invoice total** (no required line-item breakdown); staff may always substitute a **custom total** for the system default.

**Why this priority**: Phase 2 includes invoices and payments as part of core workflows; complements UC-409 with UC-401, UC-403, UC-404, UC-405.

**Independent Test**: After a stay, create or adjust invoice flow, record payment, mark paid; verify status transitions and audit.

**Acceptance Scenarios**:

1. **Given** a reservation and guest, **When** an admin or manager creates an invoice manually, **Then** the invoice total defaults from the reservation calculation, issue date is today, due date is 30 days from today (per use case), status is **Pending**, and the invoice links to reservation and guest; staff MAY enter a **custom total** instead; zero amount triggers confirmation; if the final total differs from the calculated default, the override is audit-logged (UC-401).
2. **Given** a **Pending** invoice, **When** an admin or manager marks it paid with a selected payment method, **Then** status becomes **Paid**, payment details are stored, audit is recorded, and financial summaries can reflect the change.
3. **Given** an invoice at check-out or manual create, **When** the chosen total does not match the system-calculated default, **Then** the audit trail MUST still allow reconciliation (default vs final amount and actor).

**Traceability**: UC-401, UC-403, UC-404, UC-405, UC-409.

---

### Edge Cases

- Reservation created with status that immediately implies **Checked-in** (UC-301): room status must stay consistent with reservation state.
- Check-in attempted when the reservation is already **Checked-in**: show a clear message; do not duplicate check-in effects (UC-305).
- Check-in attempted when status is **Cancelled** or **No-show**: block with a clear message.
- Room not available or requires cleaning at check-in: block or prompt to proceed anyway per UC-305.
- Check-out attempted when status is not **Checked-in**: error (UC-306).
- Check-out or auto-invoice path attempted on **Cancelled** or **No-show**: block; these states never use the departure invoice automation.
- Double room without second guest: require explicit confirmation (UC-301).
- **Cancelled** vs **No-show**: **Cancelled** is a deliberate voiding of the booking; **No-show** is closure when the guest did not arrive—both release inventory but carry different operational meaning for reporting and optional manual fees.
- Modify dates or room while **Confirmed**: allowed with availability checks (UC-311, UC-303); not allowed once **Checked-out**, **Cancelled**, or **No-show** except under future audit-governed correction policy.
- **Room move while Checked-in**: distinct from pre-arrival room change—allowed per **3a** in the lifecycle overview; block if the target room is unavailable, out of service, or already held for overlapping stays; staff MAY be prompted when the target room needs cleaning (mirror check-in override patterns where appropriate).
- **Room move and check-out**: check-out always closes the **current** assigned room; invoice and housekeeping rules apply to that room.
- **Custom invoice total**: Staff may set any allowed total (including discounts or surcharges) subject to zero-amount confirmation rules; nonsensical values (e.g. negative) MUST be blocked or require explicit policy-aligned confirmation.
- **Phase 2 vs future folio**: Structured line items (tax lines, extras, packages) are out of scope; only one **rolled-up** amount per invoice plus notes as needed.
- Multi-property: all reservation and invoice actions apply only within the active hotel property context; cross-property operations are out of scope.

## Requirements *(mandatory)*

### Functional Requirements

**Lifecycle and states**

- **FR-001**: The system MUST represent each reservation in exactly one business state at a time, including **Confirmed**, **Checked-in**, **Checked-out**, **Cancelled**, and **No-show**. Check-in MUST be allowed only from **Confirmed** when the check-in date is today or earlier (UC-305). Check-out MUST be allowed only from **Checked-in** when the check-out date is today or earlier (UC-306).
- **FR-002**: The system MUST block check-in and check-out on **Cancelled** and **No-show** reservations with clear staff-facing messaging.
- **FR-003**: On successful check-in, the system MUST set the reservation to **Checked-in**, set the room to occupied, align housekeeping to the documented dirty/future-cleaning posture, log audit, notify housekeeping, and optionally queue channel sync (UC-305).
- **FR-004**: On successful check-out, the system MUST set the reservation to **Checked-out**, set the **currently assigned** room to cleaning-oriented state, set housekeeping dirty for that room, create an invoice linked to reservation and guest whose **single total** defaults to the reservation-calculated amount while allowing authorized staff to **substitute a custom total** before confirming; when the final total differs from that default, the system MUST record audit (actor, calculated default, final amount); the system MUST log audit, notify housekeeping, present invoice details to staff, and optionally queue channel sync; if invoice creation fails, it MUST still complete check-out and log the error (UC-306, UC-409).
- **FR-012**: From **Confirmed**, the system MUST support transition to **Cancelled** (cancellation, UC-304), releasing booked room nights to availability, with audit and optional channel sync when configured. From **Confirmed**, the system MUST support transition to **No-show** when staff record non-arrival per property timing rules (on or after scheduled check-in date), releasing nights to availability, with audit. **Cancelled** and **No-show** MUST be terminal for check-in, check-out, and auto departure billing; optional fees use manual invoice (UC-401), not UC-409.
- **FR-013**: While **Checked-in**, the system MUST allow authorized staff to move the stay to another room in the same property: validate the target room for the remainder of the stay (through scheduled check-out), release the prior room per room/housekeeping policy, occupy the new room, preserve reservation state as **Checked-in**, record audit (from-room, to-room, actor, timestamp), and optionally queue channel sync without blocking the move. A room move alone MUST NOT change the reservation’s stored stay total; pricing corrections use **custom invoice total** at check-out or manual invoice (UC-401) if the property chooses.

**Reservation creation and changes**

- **FR-005**: When creating a reservation, the system MUST validate that check-out is after check-in, verify room availability for the span, compute total from nights and nightly price, support optional second guest with confirmation when a double room lacks a second guest, allow selection of reservation status where the product requires it, record audit, and queue channel sync only if integration is configured (UC-301).
- **FR-006**: The system MUST support updating **Confirmed** reservations (modifying dates with availability checks, adding a second guest, room changes where applicable), cancelling to **Cancelled**, marking **No-show**, and checking availability as first-class operations within permissions (UC-303, UC-304, UC-309, UC-310, UC-311, UC-312).

**Discovery and presentation**

- **FR-007**: The system MUST let authorized users search reservations, view reservation details, and use a reservation calendar appropriate to their role (UC-302, UC-307, UC-308).

**Billing**

- **FR-008**: The system MUST create an invoice on check-out as the financial artifact for the stay, using a **single total** (no required line-item breakdown in Phase 2) that defaults to the system-calculated amount from the reservation, with staff able to **accept or override** that total per FR-004 (UC-409, UC-306).
- **FR-009**: The system MUST allow admins and managers to create invoices from reservation context with default total from the reservation calculation, allow **custom total** entry, issue date today, due date 30 days from today, **Pending** status, confirmation when amount is zero, and audit when the final total differs from the calculated default (UC-401).
- **FR-010**: The system MUST allow admins and managers to update invoice status, record payments, and mark invoices **Paid** with payment method selection and audit (UC-403, UC-404, UC-405).
- **FR-014**: Phase 2 invoices MUST use one **rolled-up monetary total** per invoice (optional text notes permitted); structured line items (tax breakdown, incidental lines, packages) are **out of scope** for this feature. Any staff override of the calculated default MUST be audit-visible.

**Governance**

- **FR-011**: Critical lifecycle transitions (create, update, cancel, no-show, check-in, in-stay room move, check-out, invoice create/status/payment, invoice amount override from calculated default) MUST be attributable for audit and MUST respect role permissions in `USE_CASES.md` module tables (reservation, room, housekeeping modules as applicable).

### Traceability & Constraints *(mandatory)*

| Priority requirements | Acceptance coverage |
|----------------------|---------------------|
| FR-001–FR-004, FR-008, FR-013, FR-014 | User Story 1 |
| FR-001, FR-002, FR-005, FR-006, FR-012 | User Story 2 |
| FR-007 | User Story 3 |
| FR-008–FR-010, FR-014 | User Stories 1 and 4 |
| FR-011 | All stories |

- **Schema / API / UI**: This feature is expected to drive updates to reservation, room, housekeeping, invoice, and audit behaviors; **docs/DATABASE_SCHEMA.md**, **docs/ERD.md**, API contracts, and UI flows MUST stay aligned in the same Phase 2 milestone when states or fields change.
- **Scope**: **Core PMS (non-channel)**. Channel manager (QloApps) behavior is limited to optional queueing after local success as already described in use cases; deep sync, mapping, and conflict resolution belong to Phase 3.
- **Security (pre-production gate)**: Role checks for Front Desk, Manager, Admin, and “All (with permissions)” MUST match `USE_CASES.md`; audit logging for lifecycle actions MUST be verifiable before production (aligns with Phase 2 exit criteria and Phase 4 hardening).

### Key Entities *(include if feature involves data)*

- **Hotel property (tenant scope)**: Every reservation, room, guest, invoice, and housekeeping record belongs to one property; users operate in a selected property context.
- **Reservation**: Guest(s), room, stay dates, monetary total, source, status (**Confirmed**, **Checked-in**, **Checked-out**, **Cancelled**, **No-show**), links to invoices; optional association for double occupancy.
- **Guest**: Profile used as primary (and optional secondary) guest on the reservation.
- **Room**: Physical unit with status that must stay consistent through check-in, optional in-stay reassignment, and check-out of the **current** assignment.
- **Housekeeping**: Cleaning state and notifications tied to room events at check-in, room move (prior and new room), and check-out.
- **Invoice**: Issued for the stay with a **single total** (Phase 2: no required line items); total defaults from reservation calculation but staff MAY set a **custom total**; **Pending** until paid; linked to reservation and guest; payments recorded against it; overrides of the calculated default require audit visibility.
- **Payment**: Records amount, method, and linkage to invoice when marking paid.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a standard **Confirmed** stay with valid dates and room, authorized staff complete check-in and then check-out in one session without leaving the reservation workflow, ending in **Checked-out** with an invoice linked to the stay whose total is either the calculated default or a **staff-entered custom total**.
- **SC-002**: At least nine in ten simulated operational runs (happy path and common validation failures) produce outcomes that match the documented state and room/housekeeping rules without contradictory states (e.g., **Checked-out** with room still shown as occupied).
- **SC-003**: Check-in is rejected with a clear, staff-understandable reason when the reservation is not **Confirmed**, is **Cancelled** or **No-show**, the check-in date is still in the future, or the room is unavailable—without silent partial updates.
- **SC-004**: Check-out is rejected with a clear reason when the reservation is not **Checked-in** or the check-out date is still in the future.
- **SC-005**: When automatic invoice creation fails at check-out, the guest still departs from an operational perspective (**Checked-out**), staff are informed, and the failure is recoverable (manual invoice path still available per User Story 4).
- **SC-006**: After an in-stay room move, the vacated room and the new room each reflect consistent room and housekeeping status (no duplicate “occupied by same stay” on two rooms; no vacated room left shown as occupied for that stay).

## Assumptions

- **Cancellation**: **Cancel** moves a **Confirmed** reservation to **Cancelled** and releases inventory; voiding a **Checked-in** or **Checked-out** stay is out of scope for Phase 2 (use operational correction processes later if needed).
- **No-show timing**: “On or after scheduled check-in date” for marking **No-show** is interpreted in the property’s configured calendar day (timezone from hotel settings); same-day grace is a property policy detail for implementation, not a second clarification round.
- **Reservation status at creation**: New bookings default to **Confirmed** unless staff explicitly create in **Checked-in** per UC-301; creating directly in **Checked-in** must remain consistent with room status rules in FR-005 / UC-301 step 12.
- **Channel manager**: QloApps (or successor) sync is best-effort after local commit; failures do not block core lifecycle completion in Phase 2.
- **Roles**: Actors and permissions match module tables in `docs/USE_CASES.md` sections 4 (Reservation), 5 (Invoice & Payment), 3 (Room), and 6 (Housekeeping) where room move touches room status and cleaning.
- **Invoice amount override**: Who may change the total at check-out vs. only via manual invoice (Admin/Manager) follows section 5 roles; if check-out is Front Desk–led, product MUST still allow default or override per the same permission matrix once implemented.
