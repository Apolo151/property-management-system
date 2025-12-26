import { Router } from 'express';
import { authenticateToken, requireRole } from '../auth/auth_middleware.js';
import {
  getRoomsHandler,
  getRoomHandler,
  createRoomHandler,
  updateRoomHandler,
  deleteRoomHandler,
  getRoomHousekeepingHandler,
  updateRoomHousekeepingHandler,
  getAllHousekeepingHandler,
} from './rooms_controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Room routes
router.get('/rooms', getRoomsHandler);
router.get('/rooms/:id', getRoomHandler);
router.post('/rooms', requireRole('ADMIN', 'SUPER_ADMIN'), createRoomHandler);
router.put('/rooms/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), updateRoomHandler);
router.delete('/rooms/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteRoomHandler);

// Housekeeping routes
router.get('/rooms/:id/housekeeping', getRoomHousekeepingHandler);
router.put(
  '/rooms/:id/housekeeping',
  requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HOUSEKEEPING'),
  updateRoomHousekeepingHandler,
);
router.get('/housekeeping', getAllHousekeepingHandler);

export { router as roomsRoutes };

