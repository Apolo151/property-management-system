import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getHotelSettingsHandler,
  updateHotelSettingsHandler,
  clearAllDataHandler,
} from './settings_controller.js';
import {
  getChannelManagerStatusHandler,
  switchChannelManagerHandler,
  testQloAppsConnectionHandler,
  setupQloAppsConnectionHandler,
} from './channel_manager_controller.js';

const router = Router();

// All routes require authentication and hotel context
router.use(authenticateToken);
router.use(hotelContext);

// Hotel settings routes
router.get('/settings', getHotelSettingsHandler);
router.put(
  '/settings',
  requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'),
  updateHotelSettingsHandler,
);

// ============================================================================
// Channel Manager Routes
// ============================================================================

// Get channel manager status (which is active, what's configured)
router.get(
  '/settings/channel-manager',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  getChannelManagerStatusHandler,
);

// Switch active channel manager
router.post(
  '/settings/channel-manager/switch',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  switchChannelManagerHandler,
);

// Test QloApps connection
router.post(
  '/settings/channel-manager/test-qloapps',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  testQloAppsConnectionHandler,
);

// Setup QloApps configuration
router.post(
  '/settings/channel-manager/setup-qloapps',
  requireRole('ADMIN', 'SUPER_ADMIN'),
  setupQloAppsConnectionHandler,
);

// ============================================================================
// Data Management Routes
// ============================================================================

// Data management routes
router.post(
  '/settings/clear-all-data',
  requireRole('SUPER_ADMIN'), // Only SUPER_ADMIN can clear all data
  clearAllDataHandler,
);

export { router as settingsRoutes };

