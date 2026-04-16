/**
 * Check-in / Check-out E2E Tests (UC-305 – UC-306)
 *
 * This covers the core business lifecycle:
 *   Create Reservation → Get Eligible Rooms → Check-in → Check-out → Invoice auto-created
 *
 * Run: npx vitest --project=e2e src/services/check_ins/__tests__/check_ins_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let frontDesk: SessionContext;
let viewer: SessionContext;

// IDs resolved from seeded data / created during tests
let guestId: string;
let roomTypeId: string;

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

beforeAll(async () => {
  [admin, frontDesk, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'front_desk'),
    createSession(app, 'viewer'),
  ]);

  const gRes = await request(app).get('/api/v1/guests').set(admin.headers);
  const guests = Array.isArray(gRes.body) ? gRes.body : (gRes.body.data ?? gRes.body.guests ?? []);
  guestId = guests[0]?.id;

  const rtRes = await request(app).get('/api/v1/room-types').set(admin.headers);
  const roomTypes = Array.isArray(rtRes.body) ? rtRes.body : (rtRes.body.data ?? []);
  roomTypeId = roomTypes[0]?.id;
});

// ── GET /check-ins (list) ────────────────────────────────────────────────────

describe('GET /check-ins – List check-ins', () => {
  it('returns 200 list of check-ins for the hotel', async () => {
    const res = await request(app).get('/api/v1/check-ins').set(admin.headers);
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.checkIns ?? []);
    expect(Array.isArray(list)).toBe(true);
  });

  it('VIEWER can list check-ins → 200', async () => {
    const res = await request(app).get('/api/v1/check-ins').set(viewer.headers);
    expect(res.status).toBe(200);
  });
});

// ── Full lifecycle: Create reservation → Check-in → Check-out ────────────────

describe('UC-305 + UC-306 – Full check-in / check-out lifecycle', () => {
  let reservationId: string;
  let checkInId: string;
  let assignedRoomId: string;

  it('Step 1: create a Confirmed reservation for today', async () => {
    expect(guestId).toBeTruthy();
    expect(roomTypeId).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/reservations')
      .set(admin.headers)
      .send({
        primary_guest_id: guestId,
        room_type_id: roomTypeId,
        check_in: addDays(0),  // today
        check_out: addDays(2),
        status: 'Confirmed',
      });

    expect([200, 201]).toContain(res.status);
    reservationId = (res.body.reservation ?? res.body).id;
    expect(reservationId).toBeTruthy();
  });

  it('Step 2: GET /reservations/:id/eligible-rooms → list of available rooms', async () => {
    if (!reservationId) return;

    const res = await request(app)
      .get(`/api/v1/reservations/${reservationId}/eligible-rooms`)
      .set(admin.headers);

    expect(res.status).toBe(200);
    const rooms = Array.isArray(res.body) ? res.body : (res.body.rooms ?? res.body.data ?? []);
    expect(rooms.length).toBeGreaterThan(0);
    assignedRoomId = rooms[0].id;
  });

  it('Step 3 – UC-305: POST /reservations/:id/check-in → status becomes Checked-in', async () => {
    if (!reservationId || !assignedRoomId) return;

    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set(frontDesk.headers)
      .send({ actual_room_id: assignedRoomId });

    expect([200, 201]).toContain(res.status);
    const body = res.body.checkIn ?? res.body;
    checkInId = body.id ?? body.check_in_id;
    expect(checkInId).toBeTruthy();

    // Verify reservation status updated
    const rvRes = await request(app)
      .get(`/api/v1/reservations/${reservationId}`)
      .set(admin.headers);
    const rv = rvRes.body.reservation ?? rvRes.body;
    expect(rv.status).toBe('Checked-in');
  });

  it('UC-305 alt – reject duplicate check-in → 400/409/422', async () => {
    if (!reservationId || !assignedRoomId) return;

    const res = await request(app)
      .post(`/api/v1/reservations/${reservationId}/check-in`)
      .set(frontDesk.headers)
      .send({ actual_room_id: assignedRoomId });

    expect([400, 409, 422]).toContain(res.status);
  });

  it('Step 4 – UC-306: PATCH /check-ins/:id/checkout → status Checked-out, room Cleaning', async () => {
    if (!checkInId) return;

    const res = await request(app)
      .patch(`/api/v1/check-ins/${checkInId}/checkout`)
      .set(frontDesk.headers)
      .send({});

    expect([200, 201]).toContain(res.status);

    // Verify room is now Cleaning
    const roomRes = await request(app)
      .get(`/api/v1/rooms/${assignedRoomId}`)
      .set(admin.headers);
    const room = roomRes.body.room ?? roomRes.body;
    expect(room.status).toBe('Cleaning');
  });

  it('UC-409: auto-generated invoice exists after checkout', async () => {
    if (!reservationId) return;

    const res = await request(app)
      .get(`/api/v1/invoices?reservation_id=${reservationId}`)
      .set(admin.headers);

    expect(res.status).toBe(200);
    const invoices = Array.isArray(res.body) ? res.body : (res.body.invoices ?? res.body.data ?? []);
    // At least one invoice should exist for this reservation
    expect(invoices.length).toBeGreaterThan(0);
  });

  it('UC-306 alt – cannot check out a non-checked-in reservation → 400/409/422', async () => {
    if (!checkInId) return;

    // Try to checkout the already-checked-out check-in
    const res = await request(app)
      .patch(`/api/v1/check-ins/${checkInId}/checkout`)
      .set(frontDesk.headers)
      .send({});

    expect([400, 409, 422]).toContain(res.status);
  });
});

// ── RBACon check-in endpoints ─────────────────────────────────────────────────

describe('RBAC – check-in endpoints', () => {
  it('VIEWER cannot create check-in → 403', async () => {
    const res = await request(app)
      .post('/api/v1/check-ins')
      .set(viewer.headers)
      .send({ reservation_id: 'some-id', actual_room_id: 'room-id' });

    expect(res.status).toBe(403);
  });
});
