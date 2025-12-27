import { Router } from 'express';
import { authenticateToken, requireRole } from '../auth/auth_middleware.js';
import {
  getRoomTypesHandler,
  getRoomTypeHandler,
  createRoomTypeHandler,
  updateRoomTypeHandler,
  deleteRoomTypeHandler,
  getRoomTypeAvailabilityHandler,
  getAvailableRoomTypesHandler,
} from './room_types_controller.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Room types CRUD
router.get('/', getRoomTypesHandler);
router.get('/available', getAvailableRoomTypesHandler);
router.get('/:id', getRoomTypeHandler);
router.get('/:id/availability', getRoomTypeAvailabilityHandler);
router.post('/', requireRole('ADMIN', 'SUPER_ADMIN'), createRoomTypeHandler);
router.put('/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER'), updateRoomTypeHandler);
router.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteRoomTypeHandler);

export default router;

