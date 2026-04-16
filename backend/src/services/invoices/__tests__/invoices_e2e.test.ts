/**
 * Invoice & Payment E2E Tests (UC-401 – UC-409)
 *
 * Run: npx vitest --project=e2e src/services/invoices/__tests__/invoices_e2e.test.ts
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

// IDs resolved from seeded data
let reservationId: string;
let guestId: string;

beforeAll(async () => {
  [admin, manager, viewer] = await Promise.all([
    createSession(app, 'super_admin'),
    createSession(app, 'manager'),
    createSession(app, 'viewer'),
  ]);

  // Get a reservation to link invoices to
  const rvRes = await request(app)
    .get('/api/v1/reservations?status=Checked-out')
    .set(admin.headers);
  const rvs = Array.isArray(rvRes.body) ? rvRes.body : (rvRes.body.data ?? rvRes.body.reservations ?? []);
  if (rvs.length > 0) {
    reservationId = rvs[0].id;
    guestId = rvs[0].primary_guest_id ?? rvs[0].guest_id;
  }
});

// ── UC-401: Create Invoice ────────────────────────────────────────────────────

describe('UC-401 – Create Invoice', () => {
  it('I1: MANAGER can create invoice linked to reservation → 200/201', async () => {
    if (!reservationId || !guestId) return;

    const res = await request(app)
      .post('/api/v1/invoices')
      .set(manager.headers)
      .send({
        reservation_id: reservationId,
        guest_id: guestId,
        amount: 500.00,
        status: 'Pending',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        notes: 'E2E test invoice',
      });

    expect([200, 201]).toContain(res.status);
    const inv = res.body.invoice ?? res.body;
    expect(inv.id).toBeTruthy();
    expect(inv.status).toBe('Pending');
  });

  it('VIEWER cannot create invoice → 403', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set(viewer.headers)
      .send({ amount: 100 });

    expect(res.status).toBe(403);
  });
});

// ── UC-402: View Invoice ──────────────────────────────────────────────────────

describe('UC-402 – View Invoice', () => {
  it('I2: GET /invoices → 200 list with seeded invoices', async () => {
    const res = await request(app).get('/api/v1/invoices').set(admin.headers);

    expect(res.status).toBe(200);
    const invoices = Array.isArray(res.body) ? res.body : (res.body.invoices ?? res.body.data ?? []);
    expect(invoices.length).toBeGreaterThan(0);
  });

  it('I8: VIEWER can read invoices → 200', async () => {
    const res = await request(app).get('/api/v1/invoices').set(viewer.headers);
    expect(res.status).toBe(200);
  });

  it('GET /invoices/:id → 200', async () => {
    const listRes = await request(app).get('/api/v1/invoices').set(admin.headers);
    const invoices = Array.isArray(listRes.body) ? listRes.body : (listRes.body.invoices ?? listRes.body.data ?? []);
    if (invoices.length === 0) return;

    const invId = invoices[0].id;
    const res = await request(app).get(`/api/v1/invoices/${invId}`).set(admin.headers);
    expect(res.status).toBe(200);
    const inv = res.body.invoice ?? res.body;
    expect(inv.id).toBe(invId);
  });
});

// ── UC-405: Mark Invoice as Paid ──────────────────────────────────────────────

describe('UC-405 – Mark Invoice as Paid', () => {
  let pendingInvoiceId: string;

  beforeAll(async () => {
    // Find a Pending invoice from the list
    const res = await request(app).get('/api/v1/invoices?status=Pending').set(admin.headers);
    const invoices = Array.isArray(res.body) ? res.body : (res.body.invoices ?? res.body.data ?? []);
    if (invoices.length > 0) pendingInvoiceId = invoices[0].id;
  });

  it('I4: MANAGER can mark pending invoice as paid with payment method', async () => {
    if (!pendingInvoiceId) return;

    const res = await request(app)
      .put(`/api/v1/invoices/${pendingInvoiceId}`)
      .set(manager.headers)
      .send({ status: 'Paid', payment_method: 'Card' });

    expect([200, 201]).toContain(res.status);
    const updated = res.body.invoice ?? res.body;
    expect(updated.status).toBe('Paid');
  });
});

// ── UC-406: Cancel Invoice ────────────────────────────────────────────────────

describe('UC-406 – Cancel Invoice', () => {
  it('I5: MANAGER can cancel an invoice', async () => {
    if (!reservationId || !guestId) return;

    // Create then cancel
    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set(admin.headers)
      .send({
        reservation_id: reservationId,
        guest_id: guestId,
        amount: 50.00,
        status: 'Pending',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
    expect([200, 201]).toContain(createRes.status);
    const invId = (createRes.body.invoice ?? createRes.body).id;

    const res = await request(app)
      .put(`/api/v1/invoices/${invId}`)
      .set(manager.headers)
      .send({ status: 'Cancelled' });

    expect([200, 201]).toContain(res.status);
    expect((res.body.invoice ?? res.body).status).toBe('Cancelled');
  });
});

// ── UC-407: PDF Generation ────────────────────────────────────────────────────

describe('UC-407 – Generate Invoice PDF', () => {
  it('I6: GET /invoices/:id/pdf → binary PDF response', async () => {
    const listRes = await request(app).get('/api/v1/invoices').set(admin.headers);
    const invoices = Array.isArray(listRes.body) ? listRes.body : (listRes.body.invoices ?? listRes.body.data ?? []);
    if (invoices.length === 0) return;

    const invId = invoices[0].id;
    const res = await request(app)
      .get(`/api/v1/invoices/${invId}/pdf`)
      .set(admin.headers);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf|octet-stream/);
  });
});
