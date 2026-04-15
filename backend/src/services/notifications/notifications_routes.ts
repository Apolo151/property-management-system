import { Router } from 'express';
import { authenticateToken, hotelContext } from '../auth/auth_middleware.js';
import {
  getNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
} from './notifications_controller.js';

const router = Router();

router.use(authenticateToken);
router.use(hotelContext);

router.get('/notifications', getNotificationsHandler);
router.patch('/notifications/:id/read', markNotificationReadHandler);
router.post('/notifications/read-all', markAllNotificationsReadHandler);

export { router as notificationsRoutes };
