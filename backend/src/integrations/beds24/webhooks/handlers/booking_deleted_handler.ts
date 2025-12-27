import type { Beds24Booking } from '../../beds24_types.js';
import db from '../../../../config/database.js';

/**
 * Handle booking.deleted webhook event
 */
export async function handleBookingDeleted(booking: Beds24Booking): Promise<{
  success: boolean;
  reservationId?: string;
  error?: string;
}> {
  try {
    if (!booking.id) {
      return {
        success: false,
        error: 'Booking ID is required for deletion',
      };
    }

    // Find existing reservation
    const existing = await db('reservations')
      .where({ beds24_booking_id: booking.id.toString() })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      // Already deleted or doesn't exist
      return {
        success: true,
      };
    }

    // Soft delete reservation
    await db('reservations')
      .where({ id: existing.id })
      .update({
        deleted_at: new Date(),
        status: 'Cancelled',
        updated_at: new Date(),
      });

    // Update room status if it was occupied
    if (existing.status === 'Checked-in') {
      const room = await db('rooms').where({ id: existing.room_id }).first();
      if (room) {
        // Check if there are other active reservations
        const activeReservations = await db('reservations')
          .where({ room_id: existing.room_id })
          .whereIn('status', ['Confirmed', 'Checked-in'])
          .whereNull('deleted_at')
          .where('id', '!=', existing.id)
          .count('* as count')
          .first();

        if (Number(activeReservations?.count || 0) === 0) {
          await db('rooms').where({ id: existing.room_id }).update({ status: 'Available' });
        }
      }
    }

    return {
      success: true,
      reservationId: existing.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

