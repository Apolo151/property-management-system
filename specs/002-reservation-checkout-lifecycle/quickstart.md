# Quickstart: Verify Reservation → Check-out Lifecycle

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-15

## Prerequisites

- Docker Compose (or local Postgres + RabbitMQ as per `backend/README.md`)
- Migrations applied; seed user and hotel with `X-Hotel-Id`
- JWT for a **FRONT_DESK** or **MANAGER** user

## Smoke scenarios

### 1. Happy path (Check-ins API)

1. Create guest + reservation (**Confirmed**) with valid `check_in` / `check_out` and room.
2. `POST /api/v1/reservations/:id/check-in` with valid `actual_room_id`.
3. Confirm `reservations.status` = `Checked-in`, `checkin_id` set, room **Occupied**.
4. `PATCH /api/v1/check-ins/:checkinId/checkout` (optional body after implementation: `amount`).
5. Confirm `Checked-out`, room **Cleaning**, housekeeping **Dirty**, **invoice** row exists (once implemented) with expected amount.

### 2. Custom invoice amount at check-out

1. After step 3 above, call checkout with body `amount` different from `reservations.total_amount`.
2. Confirm invoice `amount` matches override; **audit** records default vs final (once implemented).

### 3. Room move

1. While checked in, `POST /api/v1/check-ins/:id/change-room` with free `new_room_id`.
2. Confirm `room_assignments` row, old room Cleaning/Dirty, new room Occupied, reservation still **Checked-in**.

### 4. Cancel / No-show (after migration)

1. **Confirmed** reservation → set **Cancelled**; confirm no check-in possible; inventory freed.
2. **Confirmed** → **No-show**; same as above.

### 5. Negative tests

- Check-in while not **Confirmed** → 409.
- Check-out while not **Checked-in** → 409.
- Check-in with `check_in` date in the future (after date guard implementation) → 400/409.

## Frontend

- From Reservations UI, run check-in → check-out → confirm states and invoice panel (when built).
- Confirm legacy-only flows (if any) are removed or hidden in favor of Check-ins API.
