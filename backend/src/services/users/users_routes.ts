import { Router } from 'express';
import {
  getUsersHandler,
  getUserHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from './users_controller.js';
import { requireRole } from '../auth/auth_middleware.js';

export const usersRoutes = Router();

// All user management routes require ADMIN or SUPER_ADMIN role
usersRoutes.get('/users', requireRole('ADMIN', 'SUPER_ADMIN'), getUsersHandler);
usersRoutes.get('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), getUserHandler);
usersRoutes.post('/users', requireRole('ADMIN', 'SUPER_ADMIN'), createUserHandler);
usersRoutes.put('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), updateUserHandler);
usersRoutes.delete('/users/:id', requireRole('ADMIN', 'SUPER_ADMIN'), deleteUserHandler);

