import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getReservationsHandler,
  getReservationHandler,
  createReservationHandler,
  updateReservationHandler,
  deleteReservationHandler,
  checkAvailabilityHandler,
} from './reservations_controller.js';

const router = Router();

// All routes require authentication and hotel context
router.use(authenticateToken);
router.use(hotelContext);

// Reservation routes
router.get('/reservations', getReservationsHandler);
router.get('/reservations/:id', getReservationHandler);
router.post('/reservations', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FRONT_DESK'), createReservationHandler);
router.put('/reservations/:id', requireRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FRONT_DESK'), updateReservationHandler);
router.delete('/reservations/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteReservationHandler);

// Availability check (public for authenticated users)
router.get('/reservations/availability/check', checkAvailabilityHandler);

export { router as reservationsRoutes };

