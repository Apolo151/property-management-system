import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getGuestsHandler,
  getGuestHandler,
  createGuestHandler,
  updateGuestHandler,
  deleteGuestHandler,
} from './guests_controller.js';

const router = Router();

// All routes require authentication and hotel context
router.use(authenticateToken);
router.use(hotelContext);

// Guest routes
router.get('/guests', getGuestsHandler);
router.get('/guests/:id', getGuestHandler);
router.post('/guests', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FRONT_DESK'), createGuestHandler);
router.put('/guests/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FRONT_DESK'), updateGuestHandler);
router.delete('/guests/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteGuestHandler);

export { router as guestsRoutes };

