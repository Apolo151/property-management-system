import type { Request, Response } from 'express';
import type { Beds24Booking } from '../beds24_types.js';
import {
  validateWebhookSignature,
  isWebhookEventProcessed,
  storeWebhookEvent,
  markWebhookEventProcessed,
} from './webhook_validator.js';
import { handleBookingCreated } from './handlers/booking_created_handler.js';
import { handleBookingModified } from './handlers/booking_modified_handler.js';
import { handleBookingCancelled } from './handlers/booking_cancelled_handler.js';
import { handleBookingDeleted } from './handlers/booking_deleted_handler.js';

/**
 * Webhook event types from Beds24
 */
type WebhookEventType = 'booking.created' | 'booking.modified' | 'booking.cancelled' | 'booking.deleted';

/**
 * Beds24 webhook payload structure
 */
interface Beds24WebhookPayload {
  event: WebhookEventType;
  booking: Beds24Booking;
  eventId?: string;
  timestamp?: string;
}

/**
 * Process webhook event
 */
async function processWebhookEvent(payload: Beds24WebhookPayload): Promise<{
  success: boolean;
  reservationId?: string;
  error?: string;
}> {
  const { event, booking, eventId } = payload;

  // Route to appropriate handler
  switch (event) {
    case 'booking.created':
      return handleBookingCreated(booking);
    case 'booking.modified':
      return handleBookingModified(booking);
    case 'booking.cancelled':
      return handleBookingCancelled(booking);
    case 'booking.deleted':
      return handleBookingDeleted(booking);
    default:
      return {
        success: false,
        error: `Unknown event type: ${event}`,
      };
  }
}

/**
 * Webhook handler endpoint
 */
export async function webhookHandler(req: Request, res: Response): Promise<void> {
  try {
    // Get signature from header
    const signature = req.headers['x-beds24-signature'] as string;
    
    // Reconstruct raw body from parsed body for signature verification
    // Note: In production, consider using express.raw() middleware for webhook routes
    const rawBody = JSON.stringify(req.body);

    if (!signature) {
      res.status(401).json({
        error: 'Missing signature header',
      });
      return;
    }

    // Validate signature
    const isValid = await validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(401).json({
        error: 'Invalid signature',
      });
      return;
    }

    // Parse payload
    const payload: Beds24WebhookPayload = req.body;

    if (!payload.event || !payload.booking) {
      res.status(400).json({
        error: 'Invalid webhook payload',
      });
      return;
    }

    // Generate event ID if not provided
    const eventId = payload.eventId || `beds24-${payload.booking.id}-${Date.now()}`;

    // Check idempotency
    const alreadyProcessed = await isWebhookEventProcessed(eventId);
    if (alreadyProcessed) {
      // Already processed, return success
      res.status(200).json({
        success: true,
        message: 'Event already processed',
      });
      return;
    }

    // Store event for idempotency
    await storeWebhookEvent(eventId, payload.event, payload);

    // Process event asynchronously (don't block response)
    processWebhookEvent(payload)
      .then(async (result) => {
        await markWebhookEventProcessed(eventId, result.success, result.error);
        
        if (!result.success) {
          console.error(`Webhook processing failed for event ${eventId}:`, result.error);
        }
      })
      .catch(async (error) => {
        await markWebhookEventProcessed(
          eventId,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );
        console.error(`Webhook processing error for event ${eventId}:`, error);
      });

    // Return immediately (async processing)
    res.status(200).json({
      success: true,
      message: 'Webhook received and queued for processing',
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
}

