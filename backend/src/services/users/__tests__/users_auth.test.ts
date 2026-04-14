import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    where: vi.fn().mockReturnThis(),
    whereNull: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
  };
  const fn = vi.fn(() => chain);
  Object.assign(fn, { raw: vi.fn().mockResolvedValue(undefined) });
  return fn as typeof fn & { raw: ReturnType<typeof vi.fn> };
});

vi.mock('../../../config/database.js', () => ({
  default: mockDb,
}));

import { buildApp } from '../../../app.js';

const app = buildApp();

describe('Users API auth order', () => {
  it('returns 401 when GET /api/v1/users is called without Authorization', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
