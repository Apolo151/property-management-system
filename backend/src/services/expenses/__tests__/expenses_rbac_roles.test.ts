import { describe, it, expect } from 'vitest';
import {
  EXPENSE_READ_ROLES,
  EXPENSE_MUTATE_ROLES,
  EXPENSE_DELETE_ROLES,
} from '../expenses_routes.js';

describe('expense route RBAC (USE_CASES parity)', () => {
  it('allows VIEWER on reads only', () => {
    expect(EXPENSE_READ_ROLES).toContain('VIEWER');
  });

  it('excludes FRONT_DESK from create/update', () => {
    expect(EXPENSE_MUTATE_ROLES).not.toContain('FRONT_DESK');
    expect(EXPENSE_MUTATE_ROLES).toEqual(
      expect.arrayContaining(['ADMIN', 'SUPER_ADMIN', 'MANAGER']),
    );
  });

  it('restricts delete to admin roles', () => {
    expect(EXPENSE_DELETE_ROLES).not.toContain('FRONT_DESK');
    expect(EXPENSE_DELETE_ROLES).not.toContain('VIEWER');
    expect(EXPENSE_DELETE_ROLES).not.toContain('MANAGER');
  });
});
