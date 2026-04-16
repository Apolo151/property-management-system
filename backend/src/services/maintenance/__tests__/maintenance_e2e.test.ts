/**
 * Maintenance Management E2E Tests (UC-601 – UC-607)
 *
 * Run: npx vitest --project=e2e src/services/maintenance/__tests__/maintenance_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let maintenance: SessionContext;
let frontDesk: SessionContext;
let viewer: SessionContext;

let roomId: string;

beforeAll(async () => {
  [admin, maintenance, frontDesk, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'maintenance'),
    createSession(app, 'front_desk'),
    createSession(app, 'viewer'),
  ]);

  // Get a room id for creating maintenance requests
  const rRes = await request(app).get('/api/v1/rooms').set(admin.headers);
  const rooms = Array.isArray(rRes.body) ? rRes.body : (rRes.body.rooms ?? rRes.body.data ?? []);
  if (rooms.length > 0) roomId = rooms[0].id;
});

// ── UC-601: Create Request ────────────────────────────────────────────────────

describe('UC-601 – Create Maintenance Request', () => {
  it('M1: FRONT_DESK can create a maintenance request → 200/201', async () => {
    expect(roomId).toBeTruthy();

    const res = await request(app)
      .post('/api/v1/maintenance-requests')
      .set(frontDesk.headers)
      .send({
        room_id: roomId,
        title: 'E2E Broken Light',
        description: 'Light bulb blown in bathroom',
        priority: 'Low',
      });

    expect([200, 201]).toContain(res.status);
    const mr = res.body.maintenanceRequest ?? res.body.maintenance_request ?? res.body;
    expect(mr.id).toBeTruthy();
    expect(mr.status).toBe('Open');
  });

  it('VIEWER cannot create maintenance request → 403', async () => {
    const res = await request(app)
      .post('/api/v1/maintenance-requests')
      .set(viewer.headers)
      .send({ room_id: roomId, title: 'Bad', priority: 'Low' });

    expect(res.status).toBe(403);
  });

  it('M6 – validation: missing room_id → 400/422', async () => {
    const res = await request(app)
      .post('/api/v1/maintenance-requests')
      .set(admin.headers)
      .send({ title: 'No room', priority: 'Medium' });

    expect([400, 422]).toContain(res.status);
  });
});

// ── UC-602: View Requests ─────────────────────────────────────────────────────

describe('UC-602 – View Maintenance Requests', () => {
  it('M2: GET /maintenance-requests → 200 with seeded requests', async () => {
    const res = await request(app).get('/api/v1/maintenance-requests').set(admin.headers);

    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : (res.body.maintenanceRequests ?? res.body.data ?? []);
    expect(items.length).toBeGreaterThan(0);
  });

  it('VIEWER can read maintenance requests → 200', async () => {
    const res = await request(app).get('/api/v1/maintenance-requests').set(viewer.headers);
    expect(res.status).toBe(200);
  });

  it('M7 – tenancy: requests scoped to hotel_id', async () => {
    const res = await request(app).get('/api/v1/maintenance-requests').set(admin.headers);
    const items = Array.isArray(res.body) ? res.body : (res.body.maintenanceRequests ?? res.body.data ?? []);
    items.forEach((mr: any) => {
      expect(mr.hotel_id).toBe(admin.hotelId);
    });
  });
});

// ── UC-603 / UC-604 / UC-605: Update Status / Priority ───────────────────────

describe('UC-603–UC-605 – Update Status and Priority', () => {
  let targetId: string;

  beforeAll(async () => {
    const res = await request(app).get('/api/v1/maintenance-requests').set(admin.headers);
    const items = Array.isArray(res.body) ? res.body : (res.body.maintenanceRequests ?? res.body.data ?? []);
    const openItem = items.find((i: any) => i.status === 'Open');
    if (openItem) targetId = openItem.id;
  });

  it('M3: MAINTENANCE role can change status Open → In Progress', async () => {
    if (!targetId) return;

    const res = await request(app)
      .put(`/api/v1/maintenance-requests/${targetId}`)
      .set(maintenance.headers)
      .send({ status: 'In Progress' });

    expect([200, 201]).toContain(res.status);
    const updated = res.body.maintenanceRequest ?? res.body;
    expect(updated.status).toBe('In Progress');
  });

  it('M4/M5: MAINTENANCE role can set priority and mark Repaired', async () => {
    if (!targetId) return;

    const res = await request(app)
      .put(`/api/v1/maintenance-requests/${targetId}`)
      .set(maintenance.headers)
      .send({ status: 'Repaired', priority: 'High' });

    expect([200, 201]).toContain(res.status);
    const updated = res.body.maintenanceRequest ?? res.body;
    expect(updated.status).toBe('Repaired');
    expect(updated.priority).toBe('High');
  });

  it('VIEWER cannot update status → 403', async () => {
    if (!targetId) return;

    const res = await request(app)
      .put(`/api/v1/maintenance-requests/${targetId}`)
      .set(viewer.headers)
      .send({ status: 'Repaired' });

    expect(res.status).toBe(403);
  });
});

// ── UC-606: Search ────────────────────────────────────────────────────────────

describe('UC-606 – Search Maintenance Requests', () => {
  it('M6: filter by status → correct items returned', async () => {
    const res = await request(app)
      .get('/api/v1/maintenance-requests?status=Repaired')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const items = Array.isArray(res.body) ? res.body : (res.body.maintenanceRequests ?? res.body.data ?? []);
    items.forEach((mr: any) => expect(mr.status).toBe('Repaired'));
  });
});
