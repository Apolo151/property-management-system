/**
 * Guest Management E2E Tests (UC-101 – UC-107)
 *
 * Run: npx vitest --project=e2e src/services/guests/__tests__/guests_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession, loginAs } from '../../../test/helpers.js';
import type { SessionContext } from '../../../test/helpers.js';

const app = buildApp();

let admin: SessionContext;
let viewer: SessionContext;
let frontDesk: SessionContext;

beforeAll(async () => {
  [admin, viewer, frontDesk] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'viewer'),
    createSession(app, 'front_desk'),
  ]);
});

// ── UC-101: Create Guest ──────────────────────────────────────────────────────

describe('UC-101 – Create Guest Profile', () => {
  it('G1: FRONT_DESK can create a guest with valid data → 201', async () => {
    const email = `guest_e2e_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/api/v1/guests')
      .set(frontDesk.headers)
      .send({
        first_name: 'E2E',
        last_name: 'Guest',
        email,
        phone: '+1-555-1234',
      });

    expect([200, 201]).toContain(res.status);
    const guest = res.body.guest ?? res.body;
    expect(guest.email).toBe(email);
    expect(guest.id).toBeTruthy();
  });

  it('G1 alt: validation fails without first_name → 400/422', async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(admin.headers)
      .send({ email: `nofirstname_${Date.now()}@test.com` });

    expect([400, 422]).toContain(res.status);
  });

  it('VIEWER cannot create guest → 403', async () => {
    const res = await request(app)
      .post('/api/v1/guests')
      .set(viewer.headers)
      .send({ first_name: 'Bad', last_name: 'Actor', email: 'badactor@test.com' });

    expect(res.status).toBe(403);
  });
});

// ── UC-102: View Guest Profile ────────────────────────────────────────────────

describe('UC-102 – View Guest Profile', () => {
  it('G3: can fetch list of guests → 200 array', async () => {
    const res = await request(app)
      .get('/api/v1/guests')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const guests = Array.isArray(res.body) ? res.body : (res.body.guests ?? res.body.data ?? []);
    expect(guests.length).toBeGreaterThan(0);
  });

  it('VIEWER can read guest list → 200', async () => {
    const res = await request(app)
      .get('/api/v1/guests')
      .set(viewer.headers);

    expect(res.status).toBe(200);
  });

  it('can fetch single guest by ID → 200', async () => {
    // First get list to find a real ID
    const listRes = await request(app).get('/api/v1/guests').set(admin.headers);
    const guests = Array.isArray(listRes.body) ? listRes.body : (listRes.body.guests ?? listRes.body.data ?? []);
    expect(guests.length).toBeGreaterThan(0);
    const guestId = guests[0].id;

    const res = await request(app)
      .get(`/api/v1/guests/${guestId}`)
      .set(admin.headers);

    expect(res.status).toBe(200);
    expect(res.body.id ?? res.body.guest?.id).toBe(guestId);
  });

  it('returns 404 for non-existent guest', async () => {
    const res = await request(app)
      .get('/api/v1/guests/00000000-0000-0000-0000-000000000000')
      .set(admin.headers);

    expect([404]).toContain(res.status);
  });
});

// ── UC-103: Update Guest ──────────────────────────────────────────────────────

describe('UC-103 – Update Guest Information', () => {
  it('G4: ADMIN can update guest phone → 200', async () => {
    const listRes = await request(app).get('/api/v1/guests').set(admin.headers);
    const guests = Array.isArray(listRes.body) ? listRes.body : (listRes.body.guests ?? listRes.body.data ?? []);
    const guestId = guests[0].id;

    const res = await request(app)
      .put(`/api/v1/guests/${guestId}`)
      .set(admin.headers)
      .send({ phone: '+1-999-8888' });

    expect([200, 201]).toContain(res.status);
  });

  it('VIEWER cannot update guests → 403', async () => {
    const listRes = await request(app).get('/api/v1/guests').set(admin.headers);
    const guests = Array.isArray(listRes.body) ? listRes.body : (listRes.body.guests ?? listRes.body.data ?? []);
    const guestId = guests[0].id;

    const res = await request(app)
      .put(`/api/v1/guests/${guestId}`)
      .set(viewer.headers)
      .send({ phone: '+1-000-0000' });

    expect(res.status).toBe(403);
  });
});

// ── UC-104: Search Guests ─────────────────────────────────────────────────────

describe('UC-104 – Search Guests', () => {
  it('G5: search by name filters results', async () => {
    const res = await request(app)
      .get('/api/v1/guests?search=Alice')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const guests = Array.isArray(res.body) ? res.body : (res.body.guests ?? res.body.data ?? []);
    // All results should match "Alice" somewhere
    const allMatch = guests.every(
      (g: any) =>
        (g.first_name + ' ' + g.last_name).toLowerCase().includes('alice') ||
        (g.email ?? '').toLowerCase().includes('alice')
    );
    expect(allMatch).toBe(true);
  });
});

// ── Multi-tenancy: guests scoped to hotel ────────────────────────────────────

describe('Multi-tenancy – guests scoped to hotel', () => {
  it('T1: missing X-Hotel-Id → 400/401', async () => {
    const { token } = await loginAs(app, 'super_admin');
    const res = await request(app)
      .get('/api/v1/guests')
      .set('Authorization', `Bearer ${token}`);
    // Without X-Hotel-Id the hotelContext middleware should reject
    expect([400, 401, 422]).toContain(res.status);
  });
});
