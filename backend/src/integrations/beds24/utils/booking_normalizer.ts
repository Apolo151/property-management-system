import type { Beds24Booking } from '../beds24_types.js';

/**
 * Normalize Beds24 booking object to ensure consistent field names
 * Handles different possible field name variations from the API
 * This is a shared utility used by both pull sync and webhook handlers
 */
export function normalizeBooking(booking: any): Beds24Booking | null {
  if (!booking || typeof booking !== 'object') {
    return null;
  }

  // Map various possible field names to our expected format
  const normalized: any = {
    id: booking.id || booking.bookingId || booking.booking_id,
    masterId: booking.masterId || booking.master_id,
    propertyId: booking.propertyId || booking.property_id || booking.propertyId,
    roomId: booking.roomId || booking.room_id || booking.roomId,
    unitId: booking.unitId || booking.unit_id || null, // Beds24 unit identifier (1-based)
    status: booking.status,
    price: booking.price || booking.totalPrice || booking.total_price || 0,
    currency: booking.currency,
    source: booking.source,
    externalId: booking.externalId || booking.external_id,
    numberOfGuests: booking.numberOfGuests || booking.number_of_guests || booking.numGuests || booking.num_guests,
    specialRequests: booking.specialRequests || booking.special_requests || booking.specialRequests,
    bookingTime: booking.bookingTime || booking.booking_time,
    modified: booking.modified || booking.modifiedAt || booking.modified_at,
    channel: booking.channel,
    apiReference: booking.apiReference || booking.api_reference,
  };

  // Normalize date fields - Beds24 API uses "arrival" and "departure" (not "arrivalDate"/"departureDate")
  // Try the most common Beds24 field names first
  normalized.arrivalDate = 
    booking.arrival ||           // Beds24 API standard field name
    booking.arrivalDate || 
    booking.arrival_date || 
    booking.arrivalDateFormatted ||
    booking.arrival_date_formatted ||
    booking.checkIn || 
    booking.check_in ||
    booking.checkin ||
    booking.checkInDate ||
    booking.check_in_date ||
    booking.startDate ||
    booking.start_date ||
    booking.fromDate ||
    booking.from_date ||
    booking.dateFrom ||
    booking.date_from ||
    booking.dates?.arrival ||
    booking.dates?.arrivalDate ||
    booking.dates?.checkIn ||
    null;

  normalized.departureDate = 
    booking.departure ||         // Beds24 API standard field name
    booking.departureDate || 
    booking.departure_date || 
    booking.departureDateFormatted ||
    booking.departure_date_formatted ||
    booking.checkOut || 
    booking.check_out ||
    booking.checkout ||
    booking.checkOutDate ||
    booking.check_out_date ||
    booking.endDate ||
    booking.end_date ||
    booking.toDate ||
    booking.to_date ||
    booking.dateTo ||
    booking.date_to ||
    booking.dates?.departure ||
    booking.dates?.departureDate ||
    booking.dates?.checkOut ||
    null;
  
  // If dates are still missing, log the full booking structure for debugging
  if (!normalized.arrivalDate || !normalized.departureDate) {
    console.warn('Could not find date fields in booking. Available keys:', Object.keys(booking));
    console.warn('Full booking structure:', JSON.stringify(booking, null, 2).substring(0, 1000));
  }

  // Normalize guest object - Beds24 API can return guest data in multiple formats:
  // 1. booking.guests[] array (when includeGuests=true) - PRIMARY FORMAT
  // 2. booking.guest object (legacy/direct format)
  // 3. Top-level guest fields (firstName, lastName, etc. directly on booking)
  if (booking.guests && Array.isArray(booking.guests) && booking.guests.length > 0) {
    // Extract first guest from array (primary guest) - this is the standard Beds24 format
    const primaryGuest = booking.guests[0];
    normalized.guest = {
      firstName: primaryGuest.firstName || primaryGuest.first_name || '',
      lastName: primaryGuest.lastName || primaryGuest.last_name || '',
      email: primaryGuest.email || '',
      phone: primaryGuest.phone || primaryGuest.mobile || '',
      country: primaryGuest.country || primaryGuest.country2 || '',
      address: primaryGuest.address || '',
      city: primaryGuest.city || '',
      zip: primaryGuest.postcode || primaryGuest.postalCode || primaryGuest.postal_code || '',
    };
  } else if (booking.guest) {
    // Fallback to singular guest object
    normalized.guest = {
      firstName: booking.guest.firstName || booking.guest.first_name || '',
      lastName: booking.guest.lastName || booking.guest.last_name || '',
      email: booking.guest.email || '',
      phone: booking.guest.phone || '',
      country: booking.guest.country || '',
      address: booking.guest.address || '',
      city: booking.guest.city || '',
      zip: booking.guest.zip || booking.guest.postalCode || booking.guest.postal_code || '',
    };
  } else if (booking.firstName || booking.lastName || booking.guestFirstName || booking.guestLastName) {
    // Fallback to top-level guest fields (some API responses have guest data at booking level)
    normalized.guest = {
      firstName: booking.firstName || booking.guestFirstName || booking.guest_first_name || '',
      lastName: booking.lastName || booking.guestLastName || booking.guest_last_name || '',
      email: booking.email || booking.guestEmail || booking.guest_email || '',
      phone: booking.phone || booking.guestPhone || booking.guest_phone || booking.mobile || booking.guestMobile || '',
      country: booking.country || booking.guestCountry || booking.guest_country || '',
      address: booking.address || booking.guestAddress || booking.guest_address || '',
      city: booking.city || booking.guestCity || booking.guest_city || '',
      zip: booking.postcode || booking.postalCode || booking.guestPostcode || booking.guest_postcode || '',
    };
  }
  // If no guest data found, normalized.guest will be undefined (don't create empty object)

  return normalized as Beds24Booking;
}

