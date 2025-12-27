/**
 * Sync hooks - Queue Beds24 sync jobs when PMS data changes
 * 
 * These functions should be called after successful database operations
 */

import {
  queueReservationSync,
  queueAvailabilitySync,
  queueRatesSync,
} from '../queue/sync_jobs.js';
import db from '../../../config/database.js';

/**
 * Check if Beds24 sync is enabled
 */
async function isSyncEnabled(): Promise<boolean> {
  const propertyId = '00000000-0000-0000-0000-000000000001';
  const config = await db('beds24_config')
    .where({ property_id: propertyId })
    .first();

  return config?.sync_enabled === true && config?.push_sync_enabled === true;
}

/**
 * Queue reservation sync after create/update
 * Call this after successfully creating or updating a reservation
 */
export async function queueReservationSyncHook(
  reservationId: string,
  action: 'create' | 'update' = 'update'
): Promise<void> {
  try {
    if (!(await isSyncEnabled())) {
      return; // Sync disabled, skip
    }

    // Skip if reservation source is Beds24 (already synced)
    const reservation = await db('reservations')
      .where({ id: reservationId })
      .whereNull('deleted_at')
      .first();

    if (reservation?.source === 'Beds24') {
      return; // Skip sync for Beds24-originated reservations
    }

    // Queue sync job (fire and forget)
    queueReservationSync(reservationId, action).catch((error) => {
      console.error(`Failed to queue reservation sync for ${reservationId}:`, error);
      // Don't throw - sync failures shouldn't break the main operation
    });
  } catch (error) {
    // Log but don't throw - sync is non-blocking
    console.error(`Error in reservation sync hook for ${reservationId}:`, error);
  }
}

/**
 * Queue reservation cancellation sync
 * Call this after successfully cancelling a reservation
 */
export async function queueReservationCancelHook(reservationId: string): Promise<void> {
  try {
    if (!(await isSyncEnabled())) {
      return;
    }

    const reservation = await db('reservations')
      .where({ id: reservationId })
      .whereNull('deleted_at')
      .first();

    if (reservation?.source === 'Beds24' || !reservation?.beds24_booking_id) {
      return; // Skip if from Beds24 or not synced
    }

    queueReservationSync(reservationId, 'cancel').catch((error) => {
      console.error(`Failed to queue reservation cancel sync for ${reservationId}:`, error);
    });
  } catch (error) {
    console.error(`Error in reservation cancel sync hook for ${reservationId}:`, error);
  }
}

/**
 * Queue room availability sync
 * Call this after room status changes, housekeeping updates, or maintenance changes
 */
export async function queueRoomAvailabilitySyncHook(roomId: string): Promise<void> {
  try {
    if (!(await isSyncEnabled())) {
      return;
    }

    // Check if room is mapped to Beds24
    const room = await db('rooms').where({ id: roomId }).first();
    if (!room?.beds24_room_id) {
      return; // Room not mapped to Beds24, skip
    }

    // Queue availability sync (fire and forget)
    queueAvailabilitySync(roomId, false).catch((error) => {
      console.error(`Failed to queue availability sync for room ${roomId}:`, error);
    });
  } catch (error) {
    console.error(`Error in room availability sync hook for ${roomId}:`, error);
  }
}

/**
 * Queue room rates sync
 * Call this after room price changes
 */
export async function queueRoomRatesSyncHook(roomId: string): Promise<void> {
  try {
    if (!(await isSyncEnabled())) {
      return;
    }

    const room = await db('rooms').where({ id: roomId }).first();
    if (!room?.beds24_room_id) {
      return;
    }

    queueRatesSync(roomId).catch((error) => {
      console.error(`Failed to queue rates sync for room ${roomId}:`, error);
    });
  } catch (error) {
    console.error(`Error in room rates sync hook for ${roomId}:`, error);
  }
}

/**
 * Queue availability sync for all rooms
 * Useful for scheduled full syncs
 */
export async function queueAllRoomsAvailabilitySyncHook(): Promise<void> {
  try {
    if (!(await isSyncEnabled())) {
      return;
    }

    const rooms = await db('rooms')
      .whereNotNull('beds24_room_id')
      .select('id');

    for (const room of rooms) {
      queueRoomAvailabilitySyncHook(room.id).catch((error) => {
        console.error(`Failed to queue availability sync for room ${room.id}:`, error);
      });
    }
  } catch (error) {
    console.error('Error in all rooms availability sync hook:', error);
  }
}

