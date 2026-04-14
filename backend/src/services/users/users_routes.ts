import { Router } from 'express';
import {
  getUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from './users_controller.js';
import { authenticateToken, requireRole } from '../auth/auth_middleware.js';

export const usersRoutes = Router();

// User management: always authenticate before role checks. Listing is global for
// ADMIN/SUPER_ADMIN (no X-Hotel-Id); hotel assignment scope is enforced in users_controller.
usersRoutes.use(authenticateToken);

usersRoutes.get('/users', requireRole('ADMIN', 'SUPER_ADMIN'), getUsersHandler);
usersRoutes.get('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), getUserHandler);
usersRoutes.post('/users', requireRole('ADMIN', 'SUPER_ADMIN'), createUserHandler);
usersRoutes.put('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), updateUserHandler);
usersRoutes.delete('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteUserHandler);
