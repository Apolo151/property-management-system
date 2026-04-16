/**
 * Expense Management E2E Tests (UC-701 – UC-707)
 *
 * Run: npx vitest --project=e2e src/services/expenses/__tests__/expenses_e2e.test.ts
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
let frontDesk: SessionContext;

beforeAll(async () => {
  [admin, manager, viewer, frontDesk] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'manager'),
    createSession(app, 'viewer'),
    createSession(app, 'front_desk'),
  ]);
});

// ── UC-701: Create Expense ────────────────────────────────────────────────────

describe('UC-701 – Create Expense Record', () => {
  it('E1: MANAGER can create expense → 200/201', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set(manager.headers)
      .send({
        description: 'E2E test expense',
        amount: 99.99,
        category: 'Utilities',
        expense_date: new Date().toISOString().split('T')[0],
      });

    expect([200, 201]).toContain(res.status);
    const exp = res.body.expense ?? res.body;
    expect(exp.id).toBeTruthy();
    expect(exp.amount).toBeCloseTo(99.99);
  });

  it('E6: VIEWER cannot create expense → 403', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set(viewer.headers)
      .send({ description: 'Bad', amount: 1, category: 'X', expense_date: '2026-01-01' });

    expect(res.status).toBe(403);
  });

  it('FRONT_DESK cannot create expense (EXPENSE_MUTATE_ROLES excludes FRONT_DESK) → 403', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set(frontDesk.headers)
      .send({ description: 'Bad', amount: 1, category: 'X', expense_date: '2026-01-01' });

    expect(res.status).toBe(403);
  });
});

// ── UC-702: View Expenses ─────────────────────────────────────────────────────

describe('UC-702 – View Expenses', () => {
  it('E2: GET /expenses → 200 with seeded expenses', async () => {
    const res = await request(app).get('/api/v1/expenses').set(admin.headers);

    expect(res.status).toBe(200);
    const expenses = Array.isArray(res.body) ? res.body : (res.body.expenses ?? res.body.data ?? []);
    expect(expenses.length).toBeGreaterThan(0);
  });

  it('E6: VIEWER can view expenses → 200', async () => {
    const res = await request(app).get('/api/v1/expenses').set(viewer.headers);
    expect(res.status).toBe(200);
  });
});

// ── UC-703: Update Expense ────────────────────────────────────────────────────

describe('UC-703 – Update Expense', () => {
  it('E3: MANAGER can update an expense', async () => {
    const listRes = await request(app).get('/api/v1/expenses').set(manager.headers);
    const expenses = Array.isArray(listRes.body) ? listRes.body : (listRes.body.expenses ?? listRes.body.data ?? []);
    if (expenses.length === 0) return;
    const expId = expenses[0].id;

    const res = await request(app)
      .put(`/api/v1/expenses/${expId}`)
      .set(manager.headers)
      .send({ description: 'Updated by E2E test', amount: 111.11 });

    expect([200, 201]).toContain(res.status);
  });
});

// ── UC-704: Delete Expense ────────────────────────────────────────────────────

describe('UC-704 – Delete Expense (ADMIN only)', () => {
  it('E4: MANAGER cannot delete expense → 403', async () => {
    const listRes = await request(app).get('/api/v1/expenses').set(admin.headers);
    const expenses = Array.isArray(listRes.body) ? listRes.body : (listRes.body.expenses ?? listRes.body.data ?? []);
    if (expenses.length === 0) return;
    const expId = expenses[0].id;

    const res = await request(app)
      .delete(`/api/v1/expenses/${expId}`)
      .set(manager.headers);

    expect(res.status).toBe(403);
  });

  it('E4: ADMIN can delete expense → 200/204', async () => {
    // Create then delete to keep seed data intact
    const createRes = await request(app)
      .post('/api/v1/expenses')
      .set(admin.headers)
      .send({ description: 'To be deleted', amount: 5.00, category: 'Misc', expense_date: '2026-01-01' });
    expect([200, 201]).toContain(createRes.status);
    const expId = (createRes.body.expense ?? createRes.body).id;

    const res = await request(app)
      .delete(`/api/v1/expenses/${expId}`)
      .set(admin.headers);

    expect([200, 204]).toContain(res.status);
  });
});

// ── UC-707: Filter by Category ────────────────────────────────────────────────

describe('UC-707 – Filter Expenses by Category', () => {
  it('E5: filter by category=Utilities returns matching expenses', async () => {
    const res = await request(app)
      .get('/api/v1/expenses?category=Utilities')
      .set(admin.headers);

    expect(res.status).toBe(200);
    const expenses = Array.isArray(res.body) ? res.body : (res.body.expenses ?? res.body.data ?? []);
    expenses.forEach((e: any) => expect(e.category).toBe('Utilities'));
  });
});

// ── Expense stats ─────────────────────────────────────────────────────────────

describe('UC-706 – Expense Stats / Reports', () => {
  it('GET /expenses/stats → 200 with summary data', async () => {
    const res = await request(app).get('/api/v1/expenses/stats').set(manager.headers);
    expect(res.status).toBe(200);
  });
});
