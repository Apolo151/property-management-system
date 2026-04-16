/**
 * Hotels E2E Tests
 * 
 * Run: npx vitest --project=e2e src/services/hotels/__tests__/hotels_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let superAdmin: SessionContext;
let manager: SessionContext;
let viewer: SessionContext;

beforeAll(async () => {
  [superAdmin, manager, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'manager'),
    createSession(app, 'viewer'),
  ]);
});

// ── GET /v1/hotels ────────────────────────────────────────────────────────────

describe('GET /v1/hotels', () => {
  it('returns list of assigned hotels for SUPER_ADMIN → 200', async () => {
    const res = await request(app).get('/api/v1/hotels').set('Authorization', `Bearer ${superAdmin.token}`);
    
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.hotels ?? []);
    expect(list.length).toBeGreaterThan(0);
  });

  it('viewer can list their assigned hotels → 200', async () => {
    const res = await request(app).get('/api/v1/hotels').set('Authorization', `Bearer ${viewer.token}`);
    expect(res.status).toBe(200);
  });
});

// ── CRUD Lifecycle ─────────────────────────────────────────────────────────────

describe('Hotels CRUD Lifecycle', () => {
  let createdHotelId: string;
  const testHotelName = `E2E Hotel ${Date.now()}`;

  it('SUPER_ADMIN can create a hotel → 200/201', async () => {
    const res = await request(app)
      .post('/api/v1/hotels')
      .set('Authorization', `Bearer ${superAdmin.token}`)
      .send({
        hotel_name: testHotelName,
        currency: 'USD',
        timezone: 'UTC',
        qloapps_auth_token: 'testtoken'
      });

    // 201 Created or 200 OK depending on your controller implementation
    expect([200, 201]).toContain(res.status);
    const item = res.body.hotel ?? res.body.data ?? res.body;
    createdHotelId = item.id;
    expect(createdHotelId).toBeTruthy();
    expect(item.hotel_name).toBe(testHotelName);
  });

  it('MANAGER cannot create a hotel → 403', async () => {
    const res = await request(app)
      .post('/api/v1/hotels')
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        hotel_name: 'Mgr Hotel',
        currency: 'USD',
        timezone: 'UTC'
      });

    expect(res.status).toBe(403);
  });

  it('can fetch the created hotel by ID (SUPER_ADMIN) → 200', async () => {
    if (!createdHotelId) return;

    const res = await request(app)
      .get(`/api/v1/hotels/${createdHotelId}`)
      .set('Authorization', `Bearer ${superAdmin.token}`);

    expect(res.status).toBe(200);
    const item = res.body.hotel ?? res.body.data ?? res.body;
    expect(item.id).toBe(createdHotelId);
  });

  it('MANAGER cannot update a hotel → 403', async () => {
    if (!createdHotelId) return;

    const res = await request(app)
      .put(`/api/v1/hotels/${createdHotelId}`)
      .set('Authorization', `Bearer ${manager.token}`)
      .send({
        currency: 'EUR',
      });

    // Update requires ADMIN or SUPER_ADMIN. Since our manager session is 'MANAGER' role, it should fail
    expect(res.status).toBe(403);
  });

  it('SUPER_ADMIN can delete a hotel → 200/204', async () => {
    if (!createdHotelId) return;

    const res = await request(app)
      .delete(`/api/v1/hotels/${createdHotelId}`)
      .set('Authorization', `Bearer ${superAdmin.token}`);

    expect([200, 204]).toContain(res.status);
  });
});
