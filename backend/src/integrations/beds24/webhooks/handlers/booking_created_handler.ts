import type { Beds24Booking } from '../../beds24_types.js';
import { mapBeds24BookingToPms, mapBeds24StatusToPms } from '../../mappers/reservation_mapper.js';
import { GuestMatchingService } from '../../services/guest_matching_service.js';
import { normalizeBooking } from '../../utils/booking_normalizer.js';
import db from '../../../../config/database.js';

/**
 * Handle booking.created webhook event
 */
export async function handleBookingCreated(booking: Beds24Booking | any): Promise<{
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
    // Check if reservation already exists (by beds24_booking_id)
    if (normalizedBooking.id) {
      const existing = await db('reservations')
        .where({ beds24_booking_id: normalizedBooking.id.toString() })
        .whereNull('deleted_at')
        .first();

      if (existing) {
        // Already exists, treat as update instead
        return {
          success: true,
          reservationId: existing.id,
        };
      }
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
        normalizedBooking.id // Could pass beds24 guest ID if available
      );
    }

    // Find room by beds24_room_id
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

    // Create reservation
    const [reservation] = await db('reservations')
      .insert({
        ...reservationData,
        source: 'Beds24', // Mark as Beds24-originated
      })
      .returning('id');

    // Create primary guest link
    await db('reservation_guests').insert({
      reservation_id: reservation.id,
      guest_id: guestId,
      guest_type: 'Primary',
    });

    // Update room status if checked in
    if (reservationData.status === 'Checked-in') {
      await db('rooms').where({ id: room.id }).update({ status: 'Occupied' });
    }

    return {
      success: true,
      reservationId: reservation.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

