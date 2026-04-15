import { Router } from 'express';
import {
  loginHandler,
  registerHandler,
  refreshTokenHandler,
  meHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from './auth_controller.js';
import { authenticateToken } from './auth_middleware.js';

const router = Router();

// Public routes
router.post('/login', loginHandler);
router.post('/register', registerHandler);
router.post('/refresh', refreshTokenHandler);
router.post('/forgot-password', forgotPasswordHandler);
router.post('/reset-password', resetPasswordHandler);

// Protected routes
router.get('/me', authenticateToken, meHandler);
router.post('/change-password', authenticateToken, changePasswordHandler);

export { router as authRoutes };

