import { Router } from 'express';
import {
  loginHandler,
  registerHandler,
  refreshTokenHandler,
  meHandler,
} from './auth_controller.js';
import { authenticateToken } from './auth_middleware.js';

const router = Router();

// Public routes
router.post('/login', loginHandler);
router.post('/register', registerHandler);
router.post('/refresh', refreshTokenHandler);

// Protected routes
router.get('/me', authenticateToken, meHandler);

export { router as authRoutes };

