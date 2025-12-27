import type { Beds24Booking } from '../../beds24_types.js';
import { mapBeds24BookingToPms, mapBeds24StatusToPms } from '../../mappers/reservation_mapper.js';
import { GuestMatchingService } from '../../services/guest_matching_service.js';
import { normalizeBooking } from '../../utils/booking_normalizer.js';
import db from '../../../../config/database.js';

/**
 * Handle booking.modified webhook event
 */
export async function handleBookingModified(booking: Beds24Booking | any): Promise<{
  success: boolean;
  reservationId?: string;
  error?: string;
}> {
  try {
    // Normalize booking data (webhooks might send raw Beds24 format with guests array)
    const normalizedBooking = normalizeBooking(booking) || booking as Beds24Booking;
    
    if (!normalizedBooking) {
      return {
        success: false,
        error: 'Invalid booking data',
      };
    }
    
    if (!normalizedBooking.id) {
      return {
        success: false,
        error: 'Booking ID is required for modification',
      };
    }

    // Find existing reservation
    const existing = await db('reservations')
      .where({ beds24_booking_id: normalizedBooking.id.toString() })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      // Doesn't exist, treat as create
      const { handleBookingCreated } = await import('./booking_created_handler.js');
      return handleBookingCreated(normalizedBooking);
    }

    // Find or create guest - handle missing guest data gracefully
    const guestMatchingService = new GuestMatchingService();
    let guestId: string;
    if (!normalizedBooking.guest) {
      console.warn(`Booking ${normalizedBooking.id} has no guest data. Using Unknown Guest.`);
      guestId = await guestMatchingService.getUnknownGuestId();
    } else {
      guestId = await guestMatchingService.findOrCreateGuest(
        normalizedBooking.guest,
        normalizedBooking.id
      );
    }

    // Find room
    const room = await db('rooms')
      .where({ beds24_room_id: normalizedBooking.roomId?.toString() })
      .first();

    if (!room) {
      return {
        success: false,
        error: `Room not found for Beds24 room ID: ${normalizedBooking.roomId}`,
      };
    }

    // Map booking to PMS format
    const reservationData = mapBeds24BookingToPms(normalizedBooking, room.id, guestId);

    // Update reservation
    await db('reservations')
      .where({ id: existing.id })
      .update({
        ...reservationData,
        updated_at: new Date(),
      });

    // Update primary guest if changed
    if (existing.primary_guest_id !== guestId) {
      await db('reservation_guests')
        .where({ reservation_id: existing.id, guest_type: 'Primary' })
        .update({ guest_id: guestId });
    }

    // Update room status
    if (reservationData.status === 'Checked-in') {
      await db('rooms').where({ id: room.id }).update({ status: 'Occupied' });
    } else if (reservationData.status === 'Checked-out') {
      await db('rooms').where({ id: room.id }).update({ status: 'Cleaning' });
    } else if (reservationData.status === 'Cancelled') {
      // Only update if room was occupied by this reservation
      const roomStatus = await db('rooms').where({ id: room.id }).first();
      if (roomStatus?.status === 'Occupied') {
        // Check if this is the only active reservation
        const activeReservations = await db('reservations')
          .where({ room_id: room.id })
          .whereIn('status', ['Confirmed', 'Checked-in'])
          .whereNull('deleted_at')
          .where('id', '!=', existing.id)
          .count('* as count')
          .first();

        if (Number(activeReservations?.count || 0) === 0) {
          await db('rooms').where({ id: room.id }).update({ status: 'Available' });
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

