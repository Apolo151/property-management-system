import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../auth/auth_middleware.js';

const hotelA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const { whereSpy, mockDb } = vi.hoisted(() => {
  const whereSpy = vi.fn().mockReturnThis();
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: whereSpy,
    whereNull: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  };
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(onFulfilled([]));
  const mockDb = vi.fn(() => chain);
  return { whereSpy, mockDb };
});

vi.mock('../../../config/database.js', () => ({
  default: mockDb,
}));

import { getMaintenanceRequestsHandler } from '../maintenance_controller.js';

describe('maintenance tenancy', () => {
  it('scopes list query to maintenance_requests.hotel_id and rooms.hotel_id', async () => {
    const req = {
      hotelId: hotelA,
      query: {},
    } as AuthenticatedRequest;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await getMaintenanceRequestsHandler(req, res, next);

    expect(whereSpy).toHaveBeenCalledWith('maintenance_requests.hotel_id', hotelA);
    expect(whereSpy).toHaveBeenCalledWith('rooms.hotel_id', hotelA);
  });
});
