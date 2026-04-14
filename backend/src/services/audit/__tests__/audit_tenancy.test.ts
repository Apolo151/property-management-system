import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../auth/auth_middleware.js';

const hotelA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const { whereSpy, mockDb, listChain, countChain } = vi.hoisted(() => {
  const whereSpy = vi.fn().mockReturnThis();

  const listChain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: whereSpy,
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };
  listChain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(onFulfilled([]));

  const countChain = {
    where: whereSpy,
    count: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({ count: '0' }),
  };

  const mockDb = vi.fn();

  return { whereSpy, mockDb, listChain, countChain };
});

vi.mock('../../../config/database.js', () => ({
  default: mockDb,
}));

import { getAuditLogsHandler } from '../audit_controller.js';

describe('audit tenancy', () => {
  beforeEach(() => {
    mockDb.mockReset();
    mockDb.mockImplementationOnce(() => listChain);
    mockDb.mockImplementationOnce(() => countChain);
  });

  it('scopes audit list and count queries to audit_logs.hotel_id', async () => {
    const req = {
      hotelId: hotelA,
      query: {},
    } as AuthenticatedRequest;
    const res = {
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await getAuditLogsHandler(req, res, next);

    expect(whereSpy).toHaveBeenCalledWith('audit_logs.hotel_id', hotelA);
  });
});
