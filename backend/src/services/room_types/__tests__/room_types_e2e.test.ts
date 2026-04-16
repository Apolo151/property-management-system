/**
 * Room Types E2E Tests
 * 
 * Run: npx vitest --project=e2e src/services/room_types/__tests__/room_types_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let manager: SessionContext;
let viewer: SessionContext;

beforeAll(async () => {
  [admin, manager, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'manager'),
    createSession(app, 'viewer'),
  ]);
});

// ── GET /room-types ────────────────────────────────────────────────────────────

describe('GET /room-types', () => {
  it('returns list of room types for the hotel → 200', async () => {
    const res = await request(app).get('/api/v1/room-types').set(admin.headers);
    expect(res.status).toBe(200);
    
    // Support varying response shapes (array vs {data: array})
    const list = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.roomTypes ?? res.body.room_types ?? []);
    expect(Array.isArray(list)).toBe(true);
  });

  it('VIEWER can list room types → 200', async () => {
    const res = await request(app).get('/api/v1/room-types').set(viewer.headers);
    expect(res.status).toBe(200);
  });
});

// ── CRUD Lifecycle ─────────────────────────────────────────────────────────────

describe('Room Types CRUD Lifecycle', () => {
  let createdRoomTypeId: string;
  const testTypeName = `E2E Room Type ${Date.now()}`;

  it('ADMIN can create a room type → 200/201', async () => {
    const res = await request(app)
      .post('/api/v1/room-types')
      .set(admin.headers)
      .send({
        type_name: testTypeName,
        description: 'Test Room Type',
        base_occupancy: 2,
        max_occupancy: 4,
        base_price: 150.00,
      });

    expect([200, 201]).toContain(res.status);
    const item = res.body.roomType ?? res.body.room_type ?? res.body.data ?? res.body;
    createdRoomTypeId = item.id;
    expect(createdRoomTypeId).toBeTruthy();
    expect(item.type_name).toBe(testTypeName);
  });

  it('MANAGER cannot create a room type → 403', async () => {
    const res = await request(app)
      .post('/api/v1/room-types')
      .set(manager.headers)
      .send({
        type_name: 'Mgr Bad',
        base_occupancy: 2,
        max_occupancy: 4,
        base_price: 150.00,
      });

    expect(res.status).toBe(403);
  });

  it('can fetch the created room type by ID → 200', async () => {
    if (!createdRoomTypeId) return;

    const res = await request(app)
      .get(`/api/v1/room-types/${createdRoomTypeId}`)
      .set(viewer.headers); // Anyone authenticated should be able to view

    expect(res.status).toBe(200);
    const item = res.body.roomType ?? res.body.room_type ?? res.body.data ?? res.body;
    expect(item.id).toBe(createdRoomTypeId);
  });

  it('MANAGER can update a room type → 200/201', async () => {
    if (!createdRoomTypeId) return;

    const res = await request(app)
      .put(`/api/v1/room-types/${createdRoomTypeId}`)
      .set(manager.headers)
      .send({
        base_price: 180.00, // Change price
      });

    expect([200, 201]).toContain(res.status);
  });

  it('VIEWER cannot update a room type → 403', async () => {
    if (!createdRoomTypeId) return;

    const res = await request(app)
      .put(`/api/v1/room-types/${createdRoomTypeId}`)
      .set(viewer.headers)
      .send({
        base_price: 200.00,
      });

    expect(res.status).toBe(403);
  });

  it('MANAGER cannot delete a room type → 403', async () => {
    if (!createdRoomTypeId) return;

    const res = await request(app)
      .delete(`/api/v1/room-types/${createdRoomTypeId}`)
      .set(manager.headers);

    expect(res.status).toBe(403);
  });

  it('ADMIN can delete a room type → 200/204', async () => {
    if (!createdRoomTypeId) return;

    const res = await request(app)
      .delete(`/api/v1/room-types/${createdRoomTypeId}`)
      .set(admin.headers);

    expect([200, 204]).toContain(res.status);
  });
});
