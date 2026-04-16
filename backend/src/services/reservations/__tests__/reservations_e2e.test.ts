/**
 * Reservation Management E2E Tests (UC-301 – UC-312)
 *
 * Run: npx vitest --project=e2e src/services/reservations/__tests__/reservations_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession, loginAs } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let manager: SessionContext;
let frontDesk: SessionContext;
let viewer: SessionContext;

// IDs resolved from seeded data
let guestId: string;
let roomTypeId: string;

// Utility: add days to today
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

beforeAll(async () => {
  [admin, manager, frontDesk, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'manager'),
    createSession(app, 'front_desk'),
    createSession(app, 'viewer'),
  ]);

  // Resolve guest id
  const gRes = await request(app).get('/api/v1/guests').set(admin.headers);
  const guests = Array.isArray(gRes.body) ? gRes.body : (gRes.body.data ?? gRes.body.guests ?? []);
  guestId = guests[0]?.id;

  // Resolve room type id
  const rtRes = await request(app).get('/api/v1/room-types').set(admin.headers);
  const roomTypes = Array.isArray(rtRes.body) ? rtRes.body : (rtRes.body.data ?? []);
  roomTypeId = roomTypes[0]?.id;
});

// ── UC-301: Create Reservation ────────────────────────────────────────────────

describe('UC-301 – Create Reservation', () => {
  it('RV1: FRONT_DESK creates a valid reservation → 201', async () => {
    expect(guestId).toBeTruthy();
    expect(roomTypeId).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/reservations')
      .set(frontDesk.headers)
      .send({
        primary_guest_id: guestId,
        room_type_id: roomTypeId,
        check_in: addDays(20),
        check_out: addDays(23),
        status: 'Confirmed',
      });

    expect([200, 201]).toContain(res.status);
    const rv = res.body.reservation ?? res.body;
    expect(rv.id).toBeTruthy();
    expect(rv.status).toBe('Confirmed');
  });

  it('RV2 – validation: check_out before check_in → 400/422', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(admin.headers)
      .send({
        primary_guest_id: guestId,
        room_type_id: roomTypeId,
        check_in: addDays(5),
        check_out: addDays(3), // before check_in!
        status: 'Confirmed',
      });

    expect([400, 422]).toContain(res.status);
  });

  it('VIEWER cannot create reservation → 403', async () => {
    const res = await request(app)
      .post('/api/v1/reservations')
      .set(viewer.headers)
      .send({
        primary_guest_id: guestId,
        room_type_id: roomTypeId,
        check_in: addDays(25),
        check_out: addDays(27),
        status: 'Confirmed',
      });

    expect(res.status).toBe(403);
  });
});

// ── UC-302: View Reservation ──────────────────────────────────────────────────

describe('UC-302 – View Reservation Details', () => {
  it('RV3: GET /reservations returns seeded list → 200', async () => {
    const res = await request(app).get('/api/v1/reservations').set(admin.headers);

    expect(res.status).toBe(200);
    const rvs = Array.isArray(res.body) ? res.body : (res.body.reservations ?? res.body.data ?? []);
    expect(rvs.length).toBeGreaterThan(0);
  });

  it('VIEWER can read reservations → 200', async () => {
    const res = await request(app).get('/api/v1/reservations').set(viewer.headers);
    expect(res.status).toBe(200);
  });

  it('GET /reservations/:id → 200 with correct reservation', async () => {
    const listRes = await request(app).get('/api/v1/reservations').set(admin.headers);
    const rvs = Array.isArray(listRes.body) ? listRes.body : (listRes.body.reservations ?? listRes.body.data ?? []);
    const rvId = rvs[0]?.id;

    const res = await request(app).get(`/api/v1/reservations/${rvId}`).set(admin.headers);
    expect(res.status).toBe(200);
    const rv = res.body.reservation ?? res.body;
    expect(rv.id).toBe(rvId);
  });
});

// ── UC-304: Cancel Reservation ────────────────────────────────────────────────

describe('UC-304 – Cancel Reservation', () => {
  it('RV5: MANAGER can cancel a Confirmed reservation → 200', async () => {
    // Create a fresh reservation to cancel (don't touch seeded ones)
    const createRes = await request(app)
      .post('/api/v1/reservations')
      .set(admin.headers)
      .send({
        primary_guest_id: guestId,
        room_type_id: roomTypeId,
        check_in: addDays(30),
        check_out: addDays(32),
        status: 'Confirmed',
      });
    expect([200, 201]).toContain(createRes.status);
    const rvId = (createRes.body.reservation ?? createRes.body).id;

    const res = await request(app)
      .put(`/api/v1/reservations/${rvId}`)
      .set(manager.headers)
      .send({ status: 'Cancelled' });

    expect([200, 201]).toContain(res.status);
    const updated = res.body.reservation ?? res.body;
    expect(updated.status).toBe('Cancelled');
  });
});

// ── UC-307: Search Reservations ───────────────────────────────────────────────

describe('UC-307 – Search Reservations', () => {
  it('RV11: filter by status=Confirmed → only Confirmed returned', async () => {
    const res = await request(app)
      .get('/api/v1/reservations?status=Confirmed')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const rvs = Array.isArray(res.body) ? res.body : (res.body.reservations ?? res.body.data ?? []);
    rvs.forEach((rv: any) => expect(rv.status).toBe('Confirmed'));
  });
});

// ── UC-310: Check Availability ────────────────────────────────────────────────

describe('UC-310 – Check Room Availability', () => {
  it('RV14: GET /reservations/availability/check → 200', async () => {
    const res = await request(app)
      .get(`/api/v1/reservations/availability/check?check_in=${addDays(40)}&check_out=${addDays(43)}&room_type_id=${roomTypeId}`)
      .set(admin.headers);

    expect(res.status).toBe(200);
  });
});
