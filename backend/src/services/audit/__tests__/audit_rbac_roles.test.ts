import { describe, it, expect } from 'vitest';
import { AUDIT_LOG_READ_ROLES, AUDIT_LOG_EXPORT_ROLES } from '../audit_routes.js';

describe('audit route RBAC (USE_CASES parity)', () => {
  it('allows VIEWER on list and detail reads', () => {
    expect(AUDIT_LOG_READ_ROLES).toContain('VIEWER');
  });

  it('does not allow VIEWER on CSV export', () => {
    expect(AUDIT_LOG_EXPORT_ROLES).not.toContain('VIEWER');
  });
});
