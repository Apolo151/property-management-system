/**
 * E2E test helpers for Hotel PMS backend tests.
 *
 * Usage pattern:
 *   import { buildApp } from '../app.js';
 *   import { loginAs, authHeader } from '../../test/helpers.js';
 *
 *   const app = buildApp();
 *   const { token, hotelId } = await loginAs('admin');
 *   const res = await request(app).get('/api/v1/guests').set(authHeader(token, hotelId));
 */

import request from 'supertest';
import type { Express } from 'express';

// ── Seeded test credentials ───────────────────────────────────────────────────

export const TEST_CREDENTIALS: Record<string, { email: string; password: string }> = {
  super_admin:   { email: 'admin@hotel.com',          password: 'admin123' },
  manager:       { email: 'manager@testhotel.com',     password: 'test1234' },
  front_desk:    { email: 'frontdesk@testhotel.com',   password: 'test1234' },
  housekeeping:  { email: 'housekeeping@testhotel.com',password: 'test1234' },
  maintenance:   { email: 'maintenance@testhotel.com', password: 'test1234' },
  viewer:        { email: 'viewer@testhotel.com',      password: 'test1234' },
};

// ── Login helper ─────────────────────────────────────────────────────────────

export interface AuthResult {
  token: string;
  refreshToken: string;
  hotelId: string;
  userId: string;
}

/**
 * Log in as a seeded test user and return tokens + hotelId.
 * @param app Express application (from buildApp())
 * @param role  One of: 'super_admin' | 'manager' | 'front_desk' | 'housekeeping' | 'maintenance' | 'viewer'
 */
export async function loginAs(app: Express, role: keyof typeof TEST_CREDENTIALS): Promise<AuthResult> {
  const creds = TEST_CREDENTIALS[role];
  if (!creds) throw new Error(`Unknown test role: ${role}`);

  const res = await request(app)
    .post('/api/auth/login')
    .send(creds);

  if (res.status !== 200) {
    throw new Error(`Login failed for role "${role}" (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const token: string = res.body.token ?? res.body.accessToken;
  const refreshToken: string = res.body.refreshToken ?? res.body.refresh_token ?? '';
  const hotelId: string = res.body.user?.hotel_id ?? res.body.hotel_id ?? '';
  const userId: string = res.body.user?.id ?? '';

  if (!token) throw new Error(`Login response missing token for role "${role}"`);

  return { token, refreshToken, hotelId, userId };
}

/**
 * Retrieve the default hotel ID from the running app.
 * Falls back to the first hotel in the database via the /api/v1/hotels endpoint.
 */
export async function getDefaultHotelId(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .get('/api/v1/hotels')
    .set('Authorization', `Bearer ${token}`);

  if (res.status !== 200) {
    throw new Error(`Failed to fetch hotels (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const hotels = Array.isArray(res.body) ? res.body : (res.body.data ?? res.body.hotels ?? []);
  if (hotels.length === 0) throw new Error('No hotels found — did you run the seeds?');
  return hotels[0].id as string;
}

// ── Header builder ────────────────────────────────────────────────────────────

/**
 * Build the standard authenticated + hotel-scoped headers object.
 */
export function authHeader(
  token: string,
  hotelId: string,
): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'X-Hotel-Id': hotelId,
    'Content-Type': 'application/json',
  };
}

// ── Convenience: login + get hotel in one call ────────────────────────────────

export interface SessionContext {
  token: string;
  refreshToken: string;
  hotelId: string;
  userId: string;
  headers: Record<string, string>;
}

export async function createSession(
  app: Express,
  role: keyof typeof TEST_CREDENTIALS,
): Promise<SessionContext> {
  const auth = await loginAs(app, role);

  // If hotelId came back empty, try to resolve it from the hotels endpoint
  let hotelId = auth.hotelId;
  if (!hotelId) {
    hotelId = await getDefaultHotelId(app, auth.token);
  }

  return {
    ...auth,
    hotelId,
    headers: authHeader(auth.token, hotelId),
  };
}
