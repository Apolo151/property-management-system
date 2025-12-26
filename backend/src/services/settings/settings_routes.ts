import { Router } from 'express';
import { authenticateToken, requireRole } from '../auth/auth_middleware.js';
import {
  getHotelSettingsHandler,
  updateHotelSettingsHandler,
} from './settings_controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Hotel settings routes
router.get('/settings', getHotelSettingsHandler);
router.put(
  '/settings',
  requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  updateHotelSettingsHandler,
);

export { router as settingsRoutes };

