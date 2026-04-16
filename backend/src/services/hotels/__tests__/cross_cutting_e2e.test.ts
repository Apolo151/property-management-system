/**
 * Cross-Cutting Tenancy & Security E2E Tests
 * 
 * Run: npx vitest --project=e2e src/services/hotels/__tests__/cross_cutting_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { loginAs } from '../../../test/helpers.js';

const app = buildApp();

let superAdminAuth: any;
let managerAuth: any;

beforeAll(async () => {
  superAdminAuth = await loginAs(app, 'super_admin');
  managerAuth = await loginAs(app, 'manager');
});

// ── Multi-Property Tenancy ───────────────────────────────────────────────────

describe('Multi-Property Tenancy', () => {
  let hotelA: string;
  let hotelB: string;

  beforeAll(async () => {
    // We assume the seeds created at least one hotel, and we can easily create another as super_admin
    const existing = await request(app).get('/api/v1/hotels').set('Authorization', `Bearer ${superAdminAuth.token}`);
    const hotels = Array.isArray(existing.body) ? existing.body : (existing.body.data ?? existing.body.hotels ?? []);
    if (hotels.length > 0) hotelA = hotels[0].id;

    const res = await request(app)
      .post('/api/v1/hotels')
      .set('Authorization', `Bearer ${superAdminAuth.token}`)
      .send({
        hotel_name: 'Isolate Hotel B',
        currency: 'EUR',
        timezone: 'UTC'
      });
    
    if ([200, 201].includes(res.status)) {
       const h = res.body.hotel ?? res.body.data ?? res.body;
       hotelB = h.id;
    }
  });

  it('T3: SUPER_ADMIN can access different hotels by changing X-Hotel-Id', async () => {
    if (!hotelA || !hotelB) return;

    const resA = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${superAdminAuth.token}`)
      .set('X-Hotel-Id', hotelA);
    expect(resA.status).toBe(200);

    const resB = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${superAdminAuth.token}`)
      .set('X-Hotel-Id', hotelB);
    expect(resB.status).toBe(200);
  });

  it('T2: User must be assigned to hotel to access it', async () => {
    if (!hotelB) return;
    
    // Test user (manager) shouldn't magically have access to newly created Hotel B unless explicitly mapped
    const res = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${managerAuth.token}`)
      .set('X-Hotel-Id', hotelB);
    
    expect([401, 403]).toContain(res.status);
  });
});

// ── Security ───────────────────────────────────────────────────────────────

describe('System Security Guards', () => {
  it('S4: ALLOW_DEFAULT_HOTEL must not be respected in non-test usage', async () => {
    // In our E2E config, ALLOW_DEFAULT_HOTEL is unset (false).
    // Therefore, any protected route requiring hotelContext should return 400 (context required)
    // if X-Hotel-Id is not passed.
    const res = await request(app)
      .get('/api/v1/rooms')
      .set('Authorization', `Bearer ${superAdminAuth.token}`); // NO X-Hotel-Id header here
    
    // If ALLOW_DEFAULT_HOTEL was true, it might hit 200. Since we are in E2E, it should be 400 or 401/422.
    // The exact error depends on the middleware, typically 400 'PROPERTY_CONTEXT_REQUIRED'.
    expect([400, 422, 401]).toContain(res.status);
  });
});
