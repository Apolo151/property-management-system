/**
 * Auth E2E Tests (UC-001 – UC-006)
 *
 * These tests run against the real application (buildApp()) with a real
 * Postgres database. Run the seed before executing:
 *   docker compose --profile tools run --rm migrate
 *   docker compose --profile tools run --rm seed
 *
 * Run: npx vitest --project=e2e src/services/auth/__tests__/auth_e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../../app.js';
import { createSession, TEST_CREDENTIALS, authHeader, loginAs } from '../../../test/helpers.js';

const app = buildApp();

// ── UC-001: Login ─────────────────────────────────────────────────────────────

describe('UC-001 – Login to System', () => {
  it('A1: returns 200 + JWT token on valid ADMIN credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(TEST_CREDENTIALS.super_admin);

    expect(res.status).toBe(200);
    const token = res.body.token ?? res.body.accessToken;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    // Should also return a refresh token
    const refreshToken = res.body.refreshToken ?? res.body.refresh_token;
    expect(typeof refreshToken).toBe('string');
  });

  it('A2: returns 401 on invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_CREDENTIALS.super_admin.email, password: 'WRONG_PASSWORD' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'somepassword' });

    expect([400, 401]).toContain(res.status);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@hotel.com' });

    expect([400, 401]).toContain(res.status);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'irrelevant' });

    expect(res.status).toBe(401);
  });

  it('login response contains user object with role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(TEST_CREDENTIALS.super_admin);

    expect(res.status).toBe(200);
    const user = res.body.user;
    expect(user).toBeDefined();
    expect(user.role).toBe('SUPER_ADMIN');
    expect(user.email).toBe(TEST_CREDENTIALS.super_admin.email);
    // Password hash must never be returned
    expect(user.password_hash).toBeUndefined();
    expect(user.password).toBeUndefined();
  });
});

// ── UC-003: Refresh token ─────────────────────────────────────────────────────

describe('UC-003 – Refresh Authentication Token', () => {
  it('A5: valid refresh token returns a new access token', async () => {
    // Step 1: login to get refresh token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send(TEST_CREDENTIALS.super_admin);
    expect(loginRes.status).toBe(200);
    const refreshToken: string = loginRes.body.refreshToken ?? loginRes.body.refresh_token;
    expect(refreshToken).toBeTruthy();

    // Step 2: use refresh token to get new access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    const newToken = refreshRes.body.token ?? refreshRes.body.accessToken;
    expect(typeof newToken).toBe('string');
    expect(newToken.length).toBeGreaterThan(20);
  });

  it('invalid refresh token returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.jwt.token' });

    expect([400, 401]).toContain(res.status);
  });
});

// ── UC-003: GET /auth/me ──────────────────────────────────────────────────────

describe('GET /auth/me – Authenticated user info', () => {
  it('returns current user info with valid token', async () => {
    const { token } = await loginAs(app, 'super_admin');

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_CREDENTIALS.super_admin.email);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── UC-005: Change password ───────────────────────────────────────────────────

describe('UC-005 – Change Password', () => {
  it('A7: returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'admin123', newPassword: 'newpass456' });

    expect(res.status).toBe(401);
  });

  it('A8: returns error when current password is wrong', async () => {
    const { token } = await loginAs(app, 'manager');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WRONGPASSWORD', newPassword: 'newpass456' });

    expect([400, 401, 422]).toContain(res.status);
    expect(res.body.error).toBeDefined();
  });
});

// ── UC-004: Forgot password ───────────────────────────────────────────────────

describe('UC-004 – Forgot Password', () => {
  it('A6: returns 200 for known email (token sent or logged)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_CREDENTIALS.manager.email });

    // Should return 200 regardless (to avoid email enumeration)
    expect([200, 204]).toContain(res.status);
  });

  it('returns 200 for unknown email (anti-enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nowhere.com' });

    expect([200, 204]).toContain(res.status);
  });
});

// ── UC-006: User management RBAC ─────────────────────────────────────────────

describe('UC-006 – Manage User Roles (RBAC)', () => {
  it('S1: unauthenticated GET /v1/users → 401', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('A10: VIEWER cannot list users → 403', async () => {
    const { token } = await loginAs(app, 'viewer');

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('A9: SUPER_ADMIN can list users → 200', async () => {
    const { token } = await loginAs(app, 'super_admin');

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) || Array.isArray(res.body.users) || Array.isArray(res.body.data)).toBe(true);
  });

  it('A9: SUPER_ADMIN can create a new user', async () => {
    const { token } = await loginAs(app, 'super_admin');

    const randomEmail = `e2etest_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: randomEmail,
        password: 'Testpass123!',
        first_name: 'E2E',
        last_name: 'TestUser',
        role: 'FRONT_DESK',
      });

    expect([200, 201]).toContain(res.status);
    const user = res.body.user ?? res.body;
    expect(user.email).toBe(randomEmail);
    expect(user.password_hash).toBeUndefined();
  });

  it('FRONT_DESK cannot create users → 403', async () => {
    const { token } = await loginAs(app, 'front_desk');

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'shouldfail@test.com',
        password: 'Testpass123!',
        first_name: 'Bad',
        last_name: 'Actor',
        role: 'FRONT_DESK',
      });

    expect(res.status).toBe(403);
  });
});

// ── Cross-cutting: tenancy & auth guards ──────────────────────────────────────

describe('Security — unauthenticated access', () => {
  const PROTECTED_ROUTES = [
    ['GET',  '/api/v1/guests'],
    ['GET',  '/api/v1/rooms'],
    ['GET',  '/api/v1/reservations'],
    ['GET',  '/api/v1/invoices'],
    ['GET',  '/api/v1/expenses'],
    ['GET',  '/api/v1/maintenance-requests'],
    ['GET',  '/api/v1/notifications'],
    ['GET',  '/api/v1/reports/stats'],
    ['GET',  '/api/v1/audit-logs'],
  ] as const;

  for (const [method, route] of PROTECTED_ROUTES) {
    it(`S1: ${method} ${route} → 401 without token`, async () => {
      const res = await (request(app) as any)[method.toLowerCase()](route);
      expect(res.status).toBe(401);
    });
  }
});
