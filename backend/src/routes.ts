// src/routes.ts
import { Router } from 'express';

import { healthCheckRoutes } from './services/health_check/health_check_routes.js';
import { authRoutes } from './services/auth/auth_routes.js';
import { hotelsRoutes } from './services/hotels/hotels_routes.js';
import { roomsRoutes } from './services/rooms/rooms_routes.js';
import roomTypesRoutes from './services/room_types/room_types_routes.js';
import { reservationsRoutes } from './services/reservations/reservations_routes.js';
import { checkInsRoutes } from './services/check_ins/check_ins_routes.js';
import { guestsRoutes } from './services/guests/guests_routes.js';
import { invoicesRoutes } from './services/invoices/invoices_routes.js';
import { expensesRoutes } from './services/expenses/expenses_routes.js';
import { maintenanceRoutes } from './services/maintenance/maintenance_routes.js';
import { reportsRoutes } from './services/reports/reports_routes.js';
import { auditRoutes } from './services/audit/audit_routes.js';
import { settingsRoutes } from './services/settings/settings_routes.js';
import { usersRoutes } from './services/users/users_routes.js';
import { qloAppsRoutes } from './services/qloapps/index.js';
import { notificationsRoutes } from './services/notifications/notifications_routes.js';

export const apiV1Router = Router();

apiV1Router.use('/health-check', healthCheckRoutes);
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/v1/hotels', hotelsRoutes);
apiV1Router.use('/v1', roomsRoutes);
apiV1Router.use('/v1/room-types', roomTypesRoutes);
apiV1Router.use('/v1', reservationsRoutes);
apiV1Router.use('/v1', checkInsRoutes);
apiV1Router.use('/v1', guestsRoutes);
apiV1Router.use('/v1', invoicesRoutes);
apiV1Router.use('/v1', expensesRoutes);
apiV1Router.use('/v1', maintenanceRoutes);
apiV1Router.use('/v1', reportsRoutes);
apiV1Router.use('/v1', auditRoutes);
apiV1Router.use('/v1', settingsRoutes);
apiV1Router.use('/v1', usersRoutes);
apiV1Router.use('/v1', notificationsRoutes);
// QloApps routes
apiV1Router.use('/v1/qloapps', qloAppsRoutes);