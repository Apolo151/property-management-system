import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getAuditLogsHandler,
  getAuditLogHandler,
} from './audit_controller.js';

const router = Router();

// All audit log routes require authentication and hotel context
// Only ADMIN, MANAGER, and SUPER_ADMIN can view audit logs
router.get(
  '/audit-logs',
  authenticateToken,
  hotelContext,
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getAuditLogsHandler,
);

router.get(
  '/audit-logs/:id',
  authenticateToken,
  hotelContext,
  requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
  getAuditLogHandler,
);

export { router as auditRoutes };



