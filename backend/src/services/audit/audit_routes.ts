import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getAuditLogsHandler,
  getAuditLogHandler,
  exportAuditLogsCsvHandler,
} from './audit_controller.js';

/** Roles that may list or read a single audit log (USE_CASES: VIEWER may read). */
export const AUDIT_LOG_READ_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'VIEWER',
] as const;

/** CSV export is restricted to operational leads (no VIEWER). */
export const AUDIT_LOG_EXPORT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const;

const router = Router();

// All audit log routes require authentication and hotel context
router.get(
  '/audit-logs/export.csv',
  authenticateToken,
  hotelContext,
  requireRole(...AUDIT_LOG_EXPORT_ROLES),
  exportAuditLogsCsvHandler,
);

router.get(
  '/audit-logs',
  authenticateToken,
  hotelContext,
  requireRole(...AUDIT_LOG_READ_ROLES),
  getAuditLogsHandler,
);

router.get(
  '/audit-logs/:id',
  authenticateToken,
  hotelContext,
  requireRole(...AUDIT_LOG_READ_ROLES),
  getAuditLogHandler,
);

export { router as auditRoutes };



