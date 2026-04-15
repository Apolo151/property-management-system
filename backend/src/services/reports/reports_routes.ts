import { Router } from 'express';
import { authenticateToken, hotelContext } from '../auth/auth_middleware.js';
import { getReportStatsHandler, exportReportsCsvHandler } from './reports_controller.js';

const router = Router();

// All routes require authentication and hotel context
router.use(authenticateToken);
router.use(hotelContext);

// Report routes
router.get('/reports/stats', getReportStatsHandler);
router.get('/reports/export.csv', exportReportsCsvHandler);

export { router as reportsRoutes };



