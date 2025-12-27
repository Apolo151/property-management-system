import { Router } from 'express';
import { webhookHandler } from './webhook_handler.js';

const router = Router();

/**
 * Beds24 webhook endpoint
 * POST /api/integrations/beds24/webhook
 * 
 * Note: This endpoint should be publicly accessible (no auth required)
 * Security is handled via HMAC signature verification
 */
router.post('/webhook', webhookHandler);

export default router;

