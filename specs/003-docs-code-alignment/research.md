# Research: Property context, UX, and reliability

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## R1 — Missing `X-Hotel-Id` on operational routes

**Decision**: In **production**, requests that use `hotelContext` MUST include a valid `X-Hotel-Id` (unless the route is explicitly documented as global). The server responds with **400** and a stable error code (e.g. `PROPERTY_CONTEXT_REQUIRED`). A **development-only** escape hatch MAY exist via environment variable (e.g. default UUID) and MUST be documented as non-production.

**Rationale**: Silent default to a canonical UUID caused **wrong-hotel** reads/writes and contradicted the API contract; explicit failure improves reliability and debuggability.

**Alternatives considered**:

- Always default UUID — rejected (fails FR-006 and SC-001).
- Require header only for non–SUPER_ADMIN — rejected for first iteration (adds cognitive load); SUPER_ADMIN still sends header for scoped views; document exception if “global browse” is added later.

## R2 — SUPER_ADMIN and audit / maintenance lists

**Decision**: For this release, **SUPER_ADMIN** uses the **same** `X-Hotel-Id` scoping as other roles when calling property-scoped list/detail endpoints: one property at a time, no cross-property aggregation in the same endpoint. Any future “global audit console” would be a **new**, explicitly documented capability.

**Rationale**: Matches spec edge case (“documentation and product behavior must agree”); avoids accidental data warehouse–scale responses and keeps UX consistent (always one active property).

**Alternatives considered**:

- SUPER_ADMIN sees all rows without header — rejected (leaks volume, complicates UI, contradicts header-based design).

## R3 — User administration and `hotelContext`

**Decision**: User CRUD routes run **`authenticateToken` first**, then **`requireRole`**. **`hotelContext`** is applied when admin actions must be **scoped** (e.g. listing “users for this property”); global user listing for SUPER_ADMIN may omit hotel context only if documented. **ADMIN** may assign `hotel_ids` only for hotels present in their **`user_hotels`** rows; **SUPER_ADMIN** may assign any valid hotel.

**Rationale**: Fixes auth ordering bug; aligns with FR-005 and Story 3 without inventing a new RBAC matrix.

**Alternatives considered**:

- Require `hotelContext` for all user routes — acceptable variant if product only supports “users visible in current property”; document in contract if chosen during implementation.

## R4 — Frontend property selection UX

**Decision**: **Single property** → auto-set `activeHotelId` after login. **Multiple properties** → force an explicit selection before operational API calls (modal, dedicated step, or redirect). Empty selection → do not call operational endpoints; show guided message.

**Rationale**: Meets SC-004 and edge case “no silent default property”; reduces support burden.

**Alternatives considered**:

- Remember last property only — good as enhancement **after** explicit first selection post-login.

## R5 — Documentation strategy for legacy SQL blocks

**Decision**: Replace or clearly label **historical** `hotel_settings` DDL in `DATABASE_SCHEMA.md` so readers cannot confuse singleton schema with current per-hotel rows.

**Rationale**: FR-002; enables SC-002 doc review without contradictions.

**Alternatives considered**:

- Delete old DDL entirely — acceptable if full replacement DDL is verified against migrations.

---

## Appendix: Route middleware inventory (implementation)

| Module | `authenticateToken` | `hotelContext` | Notes |
|--------|---------------------|----------------|--------|
| auth | partial (`/me`) | no | login/register public |
| hotels | per-route | no | property list/manage |
| users | `router.use` | no | admin user CRUD |
| rooms, room_types, reservations, check_ins, guests, invoices, expenses, maintenance, reports, audit, settings, qloapps | `router.use` | `router.use` | property-scoped |
| health | — | — | public |
