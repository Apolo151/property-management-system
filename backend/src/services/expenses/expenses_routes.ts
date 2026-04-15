import { Router } from 'express';
import { authenticateToken, requireRole, hotelContext } from '../auth/auth_middleware.js';
import {
  getExpensesHandler,
  getExpenseHandler,
  createExpenseHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
  getExpenseStatsHandler,
} from './expenses_controller.js';

export const EXPENSE_READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'VIEWER'] as const;

/** POST/PUT: FRONT_DESK excluded per USE_CASES. */
export const EXPENSE_MUTATE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const;

export const EXPENSE_DELETE_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;

const router = Router();

// All routes require authentication and hotel context
router.use(authenticateToken);
router.use(hotelContext);

router.get('/expenses', requireRole(...EXPENSE_READ_ROLES), getExpensesHandler);
router.get('/expenses/stats', requireRole(...EXPENSE_READ_ROLES), getExpenseStatsHandler);
router.get('/expenses/:id', requireRole(...EXPENSE_READ_ROLES), getExpenseHandler);
router.post('/expenses', requireRole(...EXPENSE_MUTATE_ROLES), createExpenseHandler);
router.put('/expenses/:id', requireRole(...EXPENSE_MUTATE_ROLES), updateExpenseHandler);
router.delete('/expenses/:id', requireRole(...EXPENSE_DELETE_ROLES), deleteExpenseHandler);

export { router as expensesRoutes };



