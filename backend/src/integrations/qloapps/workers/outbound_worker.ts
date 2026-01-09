/**
 * QloApps Outbound Worker
 *
 * Consumes messages from the qloapps.outbound queue and pushes
 * data from PMS to QloApps (reservations, availability, rates).
 */

import crypto from 'crypto';
import {
  QloAppsBaseConsumer,
  type QloAppsMessageContext,
} from '../queue/rabbitmq_consumer_base.js';
import {
  QLOAPPS_QUEUE_NAMES,
  type QloAppsOutboundMessage,
  type QloAppsOutboundReservationMessage,
  type QloAppsOutboundAvailabilityMessage,
  type QloAppsOutboundRateMessage,
  type QloAppsOutboundGuestMessage,
  type QloAppsOutboundRoomTypeMessage,
} from '../queue/rabbitmq_topology.js';
import { QloAppsPushSyncService } from '../services/push_sync_service.js';
import { QloAppsAvailabilitySyncService } from '../services/availability_sync_service.js';
import { QloAppsRateSyncService } from '../services/rate_sync_service.js';
import { QloAppsCustomerPushSyncService } from '../services/customer_push_sync_service.js';
import { QloAppsRoomTypePushSyncService } from '../services/room_type_push_sync_service.js';
import { QloAppsClient } from '../qloapps_client.js';
import db from '../../../config/database.js';
import { decrypt } from '../../../utils/encryption.js';

// ============================================================================
// Outbound Worker
// ============================================================================

/**
 * Worker that processes outbound sync messages to QloApps
 */
export class QloAppsOutboundWorker extends QloAppsBaseConsumer {
  constructor() {
    super(QLOAPPS_QUEUE_NAMES.OUTBOUND, {
      prefetch: 1,
      maxRetries: 3,
      retryDelayMs: 2000,
    });
  }

  /**
   * Get QloApps client for a specific config
   */
  private async getClient(configId: string): Promise<QloAppsClient> {
    console.log(`[QloApps Outbound]   Query: SELECT * FROM qloapps_config WHERE id = '${configId}'`);
    
    const config = await db('qloapps_config')
      .where({ id: configId })
      .first();

    if (!config) {
      console.error(`[QloApps Outbound] ❌ Configuration not found: ${configId}`);
      throw new Error(`QloApps config not found: ${configId}`);
    }

    console.log(`[QloApps Outbound]   Base URL: ${config.base_url}`);
    console.log(`[QloApps Outbound]   Property ID: ${config.property_id}`);
    console.log(`[QloApps Outbound]   Hotel ID: ${config.qloapps_hotel_id}`);
    console.log(`[QloApps Outbound]   Sync Enabled: ${config.sync_enabled}`);

    if (!config.sync_enabled) {
      console.error(`[QloApps Outbound] ❌ Sync is disabled for config: ${configId}`);
      throw new Error(`QloApps sync is disabled for config: ${configId}`);
    }

    const apiKey = decrypt(config.api_key_encrypted);

    return new QloAppsClient({
      baseUrl: config.base_url,
      apiKey,
      hotelId: config.qloapps_hotel_id,
    });
  }

  /**
   * Process an outbound message
   */
  protected async processMessage(context: QloAppsMessageContext): Promise<void> {
    const message = context.content as QloAppsOutboundMessage;
    const { eventType, configId } = message;

    // Log comprehensive request details
    console.log(`[QloApps Outbound] ========================================`);
    console.log(`[QloApps Outbound] 📤 NEW OUTBOUND REQUEST RECEIVED`);
    console.log(`[QloApps Outbound] ========================================`);

    // Log message metadata
    console.log(`[QloApps Outbound] 📋 Message Details:`);
    console.log(`[QloApps Outbound]   Message ID: ${(message as any).messageId || 'N/A'}`);
    console.log(`[QloApps Outbound]   Timestamp: ${(message as any).timestamp || new Date().toISOString()}`);
    console.log(`[QloApps Outbound]   Retry Count: ${(message as any).retryCount || 0}`);

    // Log RabbitMQ context
    console.log(`[QloApps Outbound] 📨 RabbitMQ Context:`);
    console.log(`[QloApps Outbound]   Delivery Tag: ${context.deliveryTag || 'N/A'}`);
    console.log(`[QloApps Outbound]   Redelivered: ${context.redelivered || false}`);
    console.log(`[QloApps Outbound]   Exchange: ${context.exchange || 'N/A'}`);
    console.log(`[QloApps Outbound]   Routing Key: ${context.routingKey || 'N/A'}`);
    console.log(`[QloApps Outbound]   Consumer Tag: ${context.consumerTag || 'N/A'}`);

    // Log message content
    console.log(`[QloApps Outbound] 📝 Message Content:`);
    console.log(`[QloApps Outbound]   Event Type: ${eventType}`);
    console.log(`[QloApps Outbound]   Config ID: ${configId}`);
    try {
      // Log full raw payload for deep debugging
      const safePayload = JSON.stringify(message);
      console.log(`[QloApps Outbound]   Raw Payload: ${safePayload}`);
    } catch {
      console.log(`[QloApps Outbound]   Raw Payload: [unserializable message object]`);
    }

    // Log entity-specific details
    if ('reservationId' in message) {
      console.log(`[QloApps Outbound]   Reservation ID: ${(message as QloAppsOutboundReservationMessage).reservationId}`);
    }
    if ('guestId' in message) {
      console.log(`[QloApps Outbound]   Guest ID: ${(message as QloAppsOutboundGuestMessage).guestId}`);
    }
    if ('roomTypeId' in message) {
      console.log(`[QloApps Outbound]   Room Type ID: ${(message as any).roomTypeId}`);
    }
    if ('dateFrom' in message && 'dateTo' in message) {
      console.log(`[QloApps Outbound]   Date Range: ${(message as any).dateFrom} to ${(message as any).dateTo}`);
    }

    console.log(`[QloApps Outbound] 🚀 Starting Processing...`);
    const startTime = Date.now();

    // Get client with logging
    console.log(`[QloApps Outbound] 🔍 Fetching configuration and initializing client...`);
    const configStart = Date.now();
    const client = await this.getClient(configId);
    const configDuration = Date.now() - configStart;
    console.log(`[QloApps Outbound] ✓ Client initialized (${configDuration}ms)`);

    // Route based on event type
    console.log(`[QloApps Outbound] 🎯 Routing to handler for: ${eventType}`);
    
    try {
      switch (eventType) {
        case 'reservation.create':
        case 'reservation.update':
          await this.handleReservationSync(
            client,
            configId,
            message as QloAppsOutboundReservationMessage
          );
          break;

        case 'reservation.cancel':
          await this.handleReservationCancel(
            client,
            configId,
            message as QloAppsOutboundReservationMessage
          );
          break;

        case 'guest.create':
        case 'guest.update':
          await this.handleGuestSync(
            client,
            configId,
            message as QloAppsOutboundGuestMessage
          );
          break;

        case 'room_type.update':
          await this.handleRoomTypeSync(
            client,
            configId,
            message as QloAppsOutboundRoomTypeMessage
          );
          break;

        case 'availability.update':
          await this.handleAvailabilitySync(
            client,
            configId,
            message as QloAppsOutboundAvailabilityMessage
          );
          break;

        case 'rate.update':
          await this.handleRateSync(
            client,
            configId,
            message as QloAppsOutboundRateMessage
          );
          break;

        default:
          console.warn(`[QloApps Outbound] ⚠️  Unknown event type: ${eventType}`);
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[QloApps Outbound] ========================================`);
      console.log(`[QloApps Outbound] ✅ PROCESSING COMPLETED SUCCESSFULLY`);
      console.log(`[QloApps Outbound] ========================================`);
      console.log(`[QloApps Outbound] 📊 Performance Summary:`);
      console.log(`[QloApps Outbound]   Total Duration: ${totalDuration}ms`);
      console.log(`[QloApps Outbound]   Event Type: ${eventType}`);
      console.log(`[QloApps Outbound]   Timestamp: ${new Date().toISOString()}`);
      console.log(`[QloApps Outbound] ========================================`);
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.log(`[QloApps Outbound] ========================================`);
      console.log(`[QloApps Outbound] ❌ PROCESSING FAILED`);
      console.log(`[QloApps Outbound] ========================================`);
      console.log(`[QloApps Outbound] 💥 Error Details:`);
      console.log(`[QloApps Outbound]   Event Type: ${eventType}`);
      console.log(`[QloApps Outbound]   Duration: ${totalDuration}ms`);
      console.log(`[QloApps Outbound]   Error: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.log(`[QloApps Outbound]   Stack: ${error.stack}`);
      }
      console.log(`[QloApps Outbound] ========================================`);
      throw error;
    }
  }

  /**
   * Handle reservation create/update
   */
  private async handleReservationSync(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundReservationMessage
  ): Promise<void> {
    const { reservationId, eventType } = message;
    console.log(`[QloApps Outbound] ┌─ RESERVATION SYNC HANDLER`);
    console.log(`[QloApps Outbound] │  Reservation ID: ${reservationId}`);
    console.log(`[QloApps Outbound] │  Event: ${eventType}`);
    console.log(`[QloApps Outbound] └─ Initializing push service...`);

    const handlerStart = Date.now();
    // Use config-aware factory to ensure propertyId and hotelId are set correctly
    const pushService = await QloAppsPushSyncService.fromConfigId(configId);

    // Get reservations to sync (just this one)
    console.log(`[QloApps Outbound] 🔍 Fetching reservation data from PMS...`);
    const fetchStart = Date.now();
    const reservations = await pushService.getReservationsToSync({
      reservationIds: [reservationId],
    });
    const fetchDuration = Date.now() - fetchStart;
    console.log(`[QloApps Outbound] ✓ Fetched ${reservations.length} reservation(s) (${fetchDuration}ms)`);

    if (reservations.length === 0) {
      console.warn(`[QloApps Outbound] ⚠️  Reservation ${reservationId} not found or not eligible for sync`);
      return;
    }

    const reservation = reservations[0];
    console.log(`[QloApps Outbound] 📝 Reservation Details:`);
    console.log(`[QloApps Outbound]   Guest ID: ${reservation.guestId}`);
    console.log(`[QloApps Outbound]   Room Type ID: ${reservation.roomTypeId}`);
    console.log(`[QloApps Outbound]   Check-in: ${reservation.checkInDate}`);
    console.log(`[QloApps Outbound]   Check-out: ${reservation.checkOutDate}`);
    console.log(`[QloApps Outbound]   Status: ${reservation.status}`);

    console.log(`[QloApps Outbound] 🚀 Pushing to QloApps...`);
    const pushStart = Date.now();
    const results = await pushService.pushReservations(reservations);
    const pushDuration = Date.now() - pushStart;
    console.log(`[QloApps Outbound] ✓ Push completed (${pushDuration}ms)`);

    const result = results[0];

    if (!result || !result.success) {
      console.error(`[QloApps Outbound] ❌ Push failed: ${result?.error || 'Unknown error'}`);
      throw new Error(`Failed to push reservation ${reservationId}: ${result?.error || 'Unknown error'}`);
    }

    console.log(`[QloApps Outbound] ✅ Reservation sync successful:`);
    console.log(`[QloApps Outbound]   PMS Reservation ID: ${reservationId}`);
    console.log(`[QloApps Outbound]   QloApps Booking ID: ${result.qloAppsBookingId}`);
    console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

    // Log the sync (build object conditionally for exactOptionalPropertyTypes)
    const logData: Parameters<typeof this.logSync>[0] = {
      configId,
      syncType: 'reservation_push',
      direction: 'outbound',
      entityType: 'reservation',
      localEntityId: reservationId,
      operation: eventType === 'reservation.create' ? 'create' : 'update',
      success: true,
    };
    if (result.qloAppsBookingId !== undefined) {
      logData.qloAppsEntityId = result.qloAppsBookingId;
    }
    await this.logSync(logData);
  }

  /**
   * Handle reservation cancellation
   * Note: Uses the same push mechanism but with cancelled status
   */
  private async handleReservationCancel(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundReservationMessage
  ): Promise<void> {
    const { reservationId } = message;
    console.log(`[QloApps Outbound] ┌─ RESERVATION CANCEL HANDLER`);
    console.log(`[QloApps Outbound] │  Reservation ID: ${reservationId}`);
    console.log(`[QloApps Outbound] └─ Looking up QloApps mapping...`);

    const handlerStart = Date.now();

    // Check if reservation is already mapped
    console.log(`[QloApps Outbound] 🔍 Query: SELECT * FROM qloapps_reservation_mappings WHERE local_reservation_id = '${reservationId}'`);
    const mappingStart = Date.now();
    const mapping = await db('qloapps_reservation_mappings')
      .where({ local_reservation_id: reservationId })
      .first();
    const mappingDuration = Date.now() - mappingStart;
    console.log(`[QloApps Outbound] ✓ Mapping lookup complete (${mappingDuration}ms)`);

    if (!mapping) {
      console.warn(`[QloApps Outbound] ⚠️  No QloApps mapping found for reservation ${reservationId}, skipping cancel`);
      return;
    }

    console.log(`[QloApps Outbound] 📝 Mapping Found:`);
    console.log(`[QloApps Outbound]   QloApps Order ID: ${mapping.qloapps_order_id}`);
    console.log(`[QloApps Outbound]   QloApps Booking ID: ${mapping.qloapps_booking_id || 'N/A'}`);

    // Update booking status to cancelled in QloApps
    try {
      console.log(`[QloApps Outbound] 🚀 Cancelling booking in QloApps...`);
      const cancelStart = Date.now();
      await client.cancelBooking(parseInt(mapping.qloapps_order_id, 10));
      const cancelDuration = Date.now() - cancelStart;
      console.log(`[QloApps Outbound] ✓ Booking cancelled in QloApps (${cancelDuration}ms)`);

      console.log(`[QloApps Outbound] 💾 Updating local mapping...`);
      const updateStart = Date.now();
      // Update mapping
      await db('qloapps_reservation_mappings')
        .where({ id: mapping.id })
        .update({
          last_synced_at: new Date(),
          updated_at: new Date(),
        });
      const updateDuration = Date.now() - updateStart;
      console.log(`[QloApps Outbound] ✓ Mapping updated (${updateDuration}ms)`);

      console.log(`[QloApps Outbound] ✅ Cancellation successful:`);
      console.log(`[QloApps Outbound]   PMS Reservation ID: ${reservationId}`);
      console.log(`[QloApps Outbound]   QloApps Order ID: ${mapping.qloapps_order_id}`);
      console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

      // Log the sync
      await this.logSync({
        configId,
        syncType: 'reservation_push',
        direction: 'outbound',
        entityType: 'reservation',
        localEntityId: reservationId,
        qloAppsEntityId: parseInt(mapping.qloapps_order_id, 10),
        operation: 'cancel',
        success: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to cancel reservation ${reservationId}: ${errorMessage}`);
    }
  }

  /**
   * Handle availability update
   */
  private async handleAvailabilitySync(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundAvailabilityMessage
  ): Promise<void> {
    const { roomTypeId, dateFrom, dateTo } = message;
    console.log(`[QloApps Outbound] ┌─ AVAILABILITY SYNC HANDLER`);
    console.log(`[QloApps Outbound] │  Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound] │  Date Range: ${dateFrom} to ${dateTo}`);
    console.log(`[QloApps Outbound] └─ Looking up room type mapping...`);

    const handlerStart = Date.now();

    // Get room type mapping
    console.log(`[QloApps Outbound] 🔍 Query: SELECT * FROM qloapps_room_type_mappings WHERE local_room_type_id = '${roomTypeId}' AND is_active = true`);
    const mappingStart = Date.now();
    const mapping = await db('qloapps_room_type_mappings')
      .where({
        local_room_type_id: roomTypeId,
        is_active: true,
      })
      .first();
    const mappingDuration = Date.now() - mappingStart;
    console.log(`[QloApps Outbound] ✓ Mapping lookup complete (${mappingDuration}ms)`);

    if (!mapping) {
      console.warn(`[QloApps Outbound] ⚠️  No QloApps mapping found for room type ${roomTypeId}, skipping availability sync`);
      return;
    }

    console.log(`[QloApps Outbound] 📝 Mapping Found:`);
    console.log(`[QloApps Outbound]   QloApps Product ID: ${mapping.qloapps_product_id}`);
    console.log(`[QloApps Outbound]   QloApps Hotel ID: ${mapping.qloapps_hotel_id}`);

    console.log(`[QloApps Outbound] 🚀 Syncing availability...`);
    const syncStart = Date.now();
    const availabilityService = new QloAppsAvailabilitySyncService(client, configId);
    const result = await availabilityService.syncRoomTypeAvailability(
      roomTypeId,
      parseInt(mapping.qloapps_product_id, 10),
      {
        startDate: new Date(dateFrom),
        endDate: new Date(dateTo),
      }
    );
    const syncDuration = Date.now() - syncStart;
    console.log(`[QloApps Outbound] ✓ Availability sync completed (${syncDuration}ms)`);

    if (!result.success) {
      console.error(`[QloApps Outbound] ❌ Availability sync failed: ${result.error || 'Unknown error'}`);
      throw new Error(
        `Failed to push availability for room type ${roomTypeId}: ${result.error || 'Unknown error'}`
      );
    }

    console.log(`[QloApps Outbound] ✅ Availability sync successful:`);
    console.log(`[QloApps Outbound]   Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound]   Date Range: ${dateFrom} to ${dateTo}`);
    console.log(`[QloApps Outbound]   Dates Updated: ${result.updatesCount}`);
    console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

    // Log the sync
    await this.logSync({
      configId,
      syncType: 'availability_push',
      direction: 'outbound',
      entityType: 'availability',
      localEntityId: roomTypeId,
      operation: 'update',
      success: true,
      metadata: { dateFrom, dateTo, updatesCount: result.updatesCount },
    });
  }

  /**
   * Handle rate update
   */
  private async handleRateSync(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundRateMessage
  ): Promise<void> {
    const { roomTypeId, dateFrom, dateTo } = message;
    console.log(`[QloApps Outbound] ┌─ RATE SYNC HANDLER`);
    console.log(`[QloApps Outbound] │  Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound] │  Date Range: ${dateFrom} to ${dateTo}`);
    console.log(`[QloApps Outbound] └─ Looking up room type mapping...`);

    const handlerStart = Date.now();

    // Get room type mapping
    console.log(`[QloApps Outbound] 🔍 Query: SELECT * FROM qloapps_room_type_mappings WHERE local_room_type_id = '${roomTypeId}' AND is_active = true`);
    const mappingStart = Date.now();
    const mapping = await db('qloapps_room_type_mappings')
      .where({
        local_room_type_id: roomTypeId,
        is_active: true,
      })
      .first();
    const mappingDuration = Date.now() - mappingStart;
    console.log(`[QloApps Outbound] ✓ Mapping lookup complete (${mappingDuration}ms)`);

    if (!mapping) {
      console.warn(`[QloApps Outbound] ⚠️  No QloApps mapping found for room type ${roomTypeId}, skipping rate sync`);
      return;
    }

    console.log(`[QloApps Outbound] 📝 Mapping Found:`);
    console.log(`[QloApps Outbound]   QloApps Product ID: ${mapping.qloapps_product_id}`);
    console.log(`[QloApps Outbound]   QloApps Hotel ID: ${mapping.qloapps_hotel_id}`);

    console.log(`[QloApps Outbound] 🚀 Syncing rates...`);
    const syncStart = Date.now();
    const rateService = new QloAppsRateSyncService(client, configId);
    const result = await rateService.syncRoomTypeRates(
      roomTypeId,
      parseInt(mapping.qloapps_product_id, 10),
      {
        startDate: new Date(dateFrom),
        endDate: new Date(dateTo),
      }
    );
    const syncDuration = Date.now() - syncStart;
    console.log(`[QloApps Outbound] ✓ Rate sync completed (${syncDuration}ms)`);

    if (!result.success) {
      console.error(`[QloApps Outbound] ❌ Rate sync failed: ${result.error || 'Unknown error'}`);
      throw new Error(
        `Failed to push rates for room type ${roomTypeId}: ${result.error || 'Unknown error'}`
      );
    }

    console.log(`[QloApps Outbound] ✅ Rate sync successful:`);
    console.log(`[QloApps Outbound]   Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound]   Date Range: ${dateFrom} to ${dateTo}`);
    console.log(`[QloApps Outbound]   Dates Updated: ${result.updatesCount}`);
    console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

    // Log the sync
    await this.logSync({
      configId,
      syncType: 'rate_push',
      direction: 'outbound',
      entityType: 'rate',
      localEntityId: roomTypeId,
      operation: 'update',
      success: true,
      metadata: { dateFrom, dateTo, updatesCount: result.updatesCount },
    });
  }

  /**
   * Handle guest create/update
   */
  private async handleGuestSync(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundGuestMessage
  ): Promise<void> {
    const { guestId, eventType } = message;
    console.log(`[QloApps Outbound] ┌─ GUEST SYNC HANDLER`);
    console.log(`[QloApps Outbound] │  Guest ID: ${guestId}`);
    console.log(`[QloApps Outbound] │  Event: ${eventType}`);
    console.log(`[QloApps Outbound] └─ Initializing customer push service...`);

    const handlerStart = Date.now();

    console.log(`[QloApps Outbound] 🔍 Fetching configuration and initializing service...`);
    const serviceStart = Date.now();
    const customerService = await QloAppsCustomerPushSyncService.fromConfigId(configId);
    const serviceDuration = Date.now() - serviceStart;
    console.log(`[QloApps Outbound] ✓ Service initialized (${serviceDuration}ms)`);

    console.log(`[QloApps Outbound] 🚀 Pushing guest to QloApps...`);
    const pushStart = Date.now();
    const result = await customerService.pushGuest(guestId);
    const pushDuration = Date.now() - pushStart;
    console.log(`[QloApps Outbound] ✓ Push completed (${pushDuration}ms)`);

    if (!result.success) {
      console.error(`[QloApps Outbound] ❌ Guest push failed: ${result.error || 'Unknown error'}`);
      throw new Error(`Failed to push guest ${guestId}: ${result.error || 'Unknown error'}`);
    }

    console.log(`[QloApps Outbound] ✅ Guest sync successful:`);
    console.log(`[QloApps Outbound]   PMS Guest ID: ${guestId}`);
    console.log(`[QloApps Outbound]   QloApps Customer ID: ${result.qloAppsCustomerId || 'N/A'}`);
    console.log(`[QloApps Outbound]   Action: ${result.action}`);
    console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

    // Log the sync
    const logData: Parameters<typeof this.logSync>[0] = {
      configId,
      syncType: 'guest_push',
      direction: 'outbound',
      entityType: 'guest',
      localEntityId: guestId,
      operation: eventType === 'guest.create' ? 'create' : 'update',
      success: true,
    };
    if (result.qloAppsCustomerId !== undefined) {
      logData.qloAppsEntityId = result.qloAppsCustomerId;
    }
    await this.logSync(logData);
  }

  /**
   * Handle room type update
   */
  private async handleRoomTypeSync(
    client: QloAppsClient,
    configId: string,
    message: QloAppsOutboundRoomTypeMessage
  ): Promise<void> {
    const { roomTypeId } = message;
    console.log(`[QloApps Outbound] ┌─ ROOM TYPE SYNC HANDLER`);
    console.log(`[QloApps Outbound] │  Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound] └─ Initializing room type push service...`);

    const handlerStart = Date.now();

    console.log(`[QloApps Outbound] 🔍 Fetching configuration and initializing service...`);
    const serviceStart = Date.now();
    const roomTypeService = await QloAppsRoomTypePushSyncService.fromConfigId(configId);
    const serviceDuration = Date.now() - serviceStart;
    console.log(`[QloApps Outbound] ✓ Service initialized (${serviceDuration}ms)`);

    console.log(`[QloApps Outbound] 🚀 Pushing room type to QloApps...`);
    const pushStart = Date.now();
    const result = await roomTypeService.pushRoomType(roomTypeId);
    const pushDuration = Date.now() - pushStart;
    console.log(`[QloApps Outbound] ✓ Push completed (${pushDuration}ms)`);

    if (!result.success && result.action === 'failed') {
      console.error(`[QloApps Outbound] ❌ Room type push failed: ${result.error || 'Unknown error'}`);
      throw new Error(`Failed to push room type ${roomTypeId}: ${result.error || 'Unknown error'}`);
    }

    const actionEmoji = result.action === 'created' ? '🆕' : 
                        result.action === 'updated' ? '♻️' : 
                        result.action === 'skipped' ? '⏭️' : 
                        '❓';

    console.log(`[QloApps Outbound] ${actionEmoji} Room type sync result:`);
    console.log(`[QloApps Outbound]   PMS Room Type ID: ${roomTypeId}`);
    console.log(`[QloApps Outbound]   QloApps Product ID: ${result.qloAppsProductId || 'N/A'}`);
    console.log(`[QloApps Outbound]   Action: ${result.action}`);
    if (result.error) {
      console.log(`[QloApps Outbound]   Note: ${result.error}`);
    }
    console.log(`[QloApps Outbound]   Total Handler Time: ${Date.now() - handlerStart}ms`);

    // Log the sync
    const logData: Parameters<typeof this.logSync>[0] = {
      configId,
      syncType: 'room_type_push',
      direction: 'outbound',
      entityType: 'room_type',
      localEntityId: roomTypeId,
      operation: 'update',
      success: result.success,
    };
    if (result.qloAppsProductId !== undefined) {
      logData.qloAppsEntityId = result.qloAppsProductId;
    }
    if (result.error) {
      logData.errorMessage = result.error;
    }
    await this.logSync(logData);
  }

  /**
   * Log a sync operation
   */
  private async logSync(data: {
    configId: string;
    syncType: string;
    direction: 'inbound' | 'outbound';
    entityType: string;
    localEntityId?: string;
    qloAppsEntityId?: number;
    operation: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const logId = crypto.randomUUID();
      console.log(`[QloApps Outbound] 📝 Logging sync operation...`);
      console.log(`[QloApps Outbound]   Log ID: ${logId}`);
      console.log(`[QloApps Outbound]   Sync Type: ${data.syncType}`);
      console.log(`[QloApps Outbound]   Entity Type: ${data.entityType}`);
      console.log(`[QloApps Outbound]   Operation: ${data.operation}`);
      console.log(`[QloApps Outbound]   Success: ${data.success}`);

      const logStart = Date.now();
      await db('qloapps_sync_logs').insert({
        id: logId,
        sync_type: data.syncType,
        direction: data.direction,
        entity_type: data.entityType,
        local_entity_id: data.localEntityId,
        qloapps_entity_id: data.qloAppsEntityId,
        operation: data.operation,
        success: data.success,
        error_message: data.errorMessage,
        created_at: new Date(),
      });
      const logDuration = Date.now() - logStart;
      console.log(`[QloApps Outbound] ✓ Sync logged to database (${logDuration}ms)`);
    } catch (error) {
      console.error('[QloApps Outbound] ❌ Failed to log sync:', error);
      console.error(`[QloApps Outbound]   Error Details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ============================================================================
// Worker Factory Functions
// ============================================================================

/**
 * Start the outbound worker
 */
export async function startQloAppsOutboundWorker(): Promise<QloAppsOutboundWorker> {
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound] 🚀 STARTING OUTBOUND WORKER`);
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound] 📊 Worker Configuration:`);
  console.log(`[QloApps Outbound]   Queue: ${QLOAPPS_QUEUE_NAMES.OUTBOUND}`);
  console.log(`[QloApps Outbound]   Prefetch: 1`);
  console.log(`[QloApps Outbound]   Max Retries: 3`);
  console.log(`[QloApps Outbound]   Retry Delay: 2000ms`);
  console.log(`[QloApps Outbound]   Timestamp: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  const worker = new QloAppsOutboundWorker();
  await worker.start();
  const startDuration = Date.now() - startTime;
  
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound] ✅ OUTBOUND WORKER STARTED SUCCESSFULLY`);
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound]   Startup Time: ${startDuration}ms`);
  console.log(`[QloApps Outbound]   Status: Ready to process messages`);
  console.log(`[QloApps Outbound] ========================================`);
  
  return worker;
}

/**
 * Stop the outbound worker
 */
export async function stopQloAppsOutboundWorker(worker: QloAppsOutboundWorker): Promise<void> {
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound] 🛑 STOPPING OUTBOUND WORKER`);
  console.log(`[QloApps Outbound] ========================================`);
  
  const stopTime = Date.now();
  await worker.stop();
  const stopDuration = Date.now() - stopTime;
  
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound] ✅ OUTBOUND WORKER STOPPED SUCCESSFULLY`);
  console.log(`[QloApps Outbound] ========================================`);
  console.log(`[QloApps Outbound]   Shutdown Time: ${stopDuration}ms`);
  console.log(`[QloApps Outbound]   Timestamp: ${new Date().toISOString()}`);
  console.log(`[QloApps Outbound] ========================================`);
}
