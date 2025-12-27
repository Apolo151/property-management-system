import type { Beds24Booking } from '../../beds24_types.js';
import db from '../../../../config/database.js';

/**
 * Handle booking.cancelled webhook event
 */
export async function handleBookingCancelled(booking: Beds24Booking): Promise<{
  success: boolean;
  reservationId?: string;
  error?: string;
}> {
  try {
    if (!booking.id) {
      return {
        success: false,
        error: 'Booking ID is required for cancellation',
      };
    }

    // Find existing reservation
    const existing = await db('reservations')
      .where({ beds24_booking_id: booking.id.toString() })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      return {
        success: false,
        error: 'Reservation not found',
      };
    }

    // Update reservation status to Cancelled
    await db('reservations')
      .where({ id: existing.id })
      .update({
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

