# Quickstart: Verify multi-property alignment (UX + reliability)

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## Prerequisites

- Backend and DB running per `backend/README.md`; migrations applied.
- **Two** hotel rows (`hotel A`, `hotel B`) and users:
  - `userA`: assigned **only** to hotel A (e.g. MANAGER).
  - `super` or `admin`: for setup and SUPER_ADMIN checks as needed.
- Rooms and at least one **maintenance request** and **audit** row per hotel (or create via API after seed).

## 1. Property context reliability (API)

1. Log in as `userA`; obtain JWT.
2. Call **maintenance list** with `X-Hotel-Id: <hotel A>` → expect only hotel A rows.
3. Repeat with `X-Hotel-Id: <hotel B>` → expect **403** `HOTEL_ACCESS_DENIED` (or 404 per policy—must not return B’s data).
4. Omit `X-Hotel-Id` on a property-scoped route (production config) → expect **400** `PROPERTY_CONTEXT_REQUIRED` (once implemented).
5. Call **audit list** with hotel A header → only A’s `hotel_id` rows.

## 2. Cross-tenant negative (maintenance detail)

1. Note a maintenance request `id` belonging to hotel B.
2. As `userA` with header hotel A, `GET` that id → expect **404** or **403**, never B’s payload.

## 3. User administration ordering

1. Call `GET /api/v1/users` **without** `Authorization` → **401** before any role success.
2. With valid ADMIN token and correct middleware order → **200** or expected role failure **403**, not silent empty success from bypass.

## 4. Frontend UX (manual)

1. Log in as user with **two** hotels: confirm **picker or blocking step** before operational pages load data.
2. Confirm **property name** visible on Maintenance and Audit pages.
3. Clear `activeHotelId` (devtools): navigate to operational page → **prompt to select property**, not silent default to wrong lists.

## 5. Documentation consistency (review)

1. Open `docs/ARCHITECTURE.md` → confirm tenancy section exists and matches this quickstart.
2. Open `docs/DATABASE_SCHEMA.md` → confirm hotel settings narrative matches multi-property; no unlabeled singleton DDL as “current”.
3. Open `core-api.md` + [contracts/property-context-and-tenancy.md](./contracts/property-context-and-tenancy.md) → no conflicting header rules.

## Exit criteria

- All API checks in §1–§3 pass.
- Manual UX checks in §4 pass or have filed follow-ups with acceptance criteria.
- §5 passes doc review checklist (SC-002).
