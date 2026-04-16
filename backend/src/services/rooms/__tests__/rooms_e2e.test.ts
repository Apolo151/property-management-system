/**
 * Room Management E2E Tests (UC-201 – UC-209)
 *
 * Run: npx vitest --project=e2e src/services/rooms/__tests__/rooms_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let viewer: SessionContext;
let housekeeping: SessionContext;
let manager: SessionContext;

beforeAll(async () => {
  [admin, viewer, housekeeping, manager] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'viewer'),
    createSession(app, 'housekeeping'),
    createSession(app, 'manager'),
  ]);
});

// Helper: get first available room id
async function getFirstRoomId(status?: string): Promise<string> {
  const url = status ? `/api/v1/rooms?status=${status}` : '/api/v1/rooms';
  const res = await request(app).get(url).set(admin.headers);
  const rooms = Array.isArray(res.body) ? res.body : (res.body.rooms ?? res.body.data ?? []);
  if (rooms.length === 0) throw new Error(`No rooms found (status=${status})`);
  return rooms[0].id;
}

// ── UC-201: Create Room ───────────────────────────────────────────────────────

describe('UC-201 – Create Room', () => {
  it('R1: ADMIN can create room → 200/201', async () => {
    // First need a room type id
    const rtRes = await request(app).get('/api/v1/room-types').set(admin.headers);
    const roomTypes = Array.isArray(rtRes.body) ? rtRes.body : (rtRes.body.data ?? []);
    expect(roomTypes.length).toBeGreaterThan(0);
    const roomTypeId = roomTypes[0].id;

    const roomNumber = `E2E-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/rooms')
      .set(admin.headers)
      .send({
        room_number: roomNumber,
        floor: 9,
        status: 'Available',
        room_type_id: roomTypeId,
      });

    expect([200, 201]).toContain(res.status);
    const room = res.body.room ?? res.body;
    expect(room.room_number).toBe(roomNumber);
  });

  it('MANAGER cannot create rooms → 403', async () => {
    const rtRes = await request(app).get('/api/v1/room-types').set(admin.headers);
    const roomTypes = Array.isArray(rtRes.body) ? rtRes.body : (rtRes.body.data ?? []);
    const roomTypeId = roomTypes[0]?.id;

    const res = await request(app)
      .post('/api/v1/rooms')
      .set(manager.headers)
      .send({ room_number: 'MGRBAD', floor: 1, status: 'Available', room_type_id: roomTypeId });

    expect(res.status).toBe(403);
  });
});

// ── UC-202: View Room ─────────────────────────────────────────────────────────

describe('UC-202 – View Room Details', () => {
  it('R2: GET /rooms → 200 list with seeded rooms', async () => {
    const res = await request(app).get('/api/v1/rooms').set(admin.headers);

    expect(res.status).toBe(200);
    const rooms = Array.isArray(res.body) ? res.body : (res.body.rooms ?? res.body.data ?? []);
    expect(rooms.length).toBeGreaterThan(0);
  });

  it('GET /rooms/:id → 200 with room details', async () => {
    const roomId = await getFirstRoomId();
    const res = await request(app).get(`/api/v1/rooms/${roomId}`).set(admin.headers);

    expect(res.status).toBe(200);
    const room = res.body.room ?? res.body;
    expect(room.id).toBe(roomId);
    expect(room.status).toBeDefined();
  });

  it('VIEWER can view rooms → 200', async () => {
    const res = await request(app).get('/api/v1/rooms').set(viewer.headers);
    expect(res.status).toBe(200);
  });
});

// ── UC-203 / UC-204: Update Room ──────────────────────────────────────────────

describe('UC-203/UC-204 – Update Room Info / Status', () => {
  it('R3/R4: MANAGER can update room status → 200', async () => {
    const roomId = await getFirstRoomId('Available');

    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}`)
      .set(manager.headers)
      .send({ status: 'Available' }); // No-op status update (idempotent)

    expect([200, 201]).toContain(res.status);
  });

  it('R4: ADMIN can mark room Out of Service', async () => {
    const roomId = await getFirstRoomId('Available');

    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}`)
      .set(admin.headers)
      .send({ status: 'Out of Service' });

    expect([200, 201]).toContain(res.status);
    const updated = res.body.room ?? res.body;
    expect(updated.status).toBe('Out of Service');

    // Restore
    await request(app)
      .put(`/api/v1/rooms/${roomId}`)
      .set(admin.headers)
      .send({ status: 'Available' });
  });

  it('VIEWER cannot update rooms → 403', async () => {
    const roomId = await getFirstRoomId();
    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}`)
      .set(viewer.headers)
      .send({ status: 'Available' });

    expect(res.status).toBe(403);
  });
});

// ── UC-205: Filter Rooms ──────────────────────────────────────────────────────

describe('UC-205 – Search/Filter Rooms', () => {
  it('R5: filter by status=Available returns only available rooms', async () => {
    const res = await request(app)
      .get('/api/v1/rooms?status=Available')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const rooms = Array.isArray(res.body) ? res.body : (res.body.rooms ?? res.body.data ?? []);
    rooms.forEach((r: any) => expect(r.status).toBe('Available'));
  });
});

// ── Housekeeping (UC-501 – UC-507) ───────────────────────────────────────────

describe('UC-501–UC-507 – Housekeeping Status', () => {
  it('H1: GET /housekeeping → 200 list', async () => {
    const res = await request(app).get('/api/v1/housekeeping').set(admin.headers);
    expect(res.status).toBe(200);
  });

  it('H2: HOUSEKEEPING role can update cleaning status → 200', async () => {
    const roomId = await getFirstRoomId('Available');

    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}/housekeeping`)
      .set(housekeeping.headers)
      .send({ status: 'Clean', notes: 'Cleaned by E2E test' });

    expect([200, 201]).toContain(res.status);
  });

  it('H4: mark room as Clean', async () => {
    const roomId = await getFirstRoomId();
    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}/housekeeping`)
      .set(housekeeping.headers)
      .send({ status: 'Clean' });

    expect([200, 201]).toContain(res.status);
  });

  it('VIEWER cannot update housekeeping → 403', async () => {
    const roomId = await getFirstRoomId();
    const res = await request(app)
      .put(`/api/v1/rooms/${roomId}/housekeeping`)
      .set(viewer.headers)
      .send({ status: 'Dirty' });

    expect(res.status).toBe(403);
  });
});
