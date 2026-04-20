import type { Request, Response, NextFunction } from 'express';
import db from '../../config/database.js';
import type {
  CreateReservationRequest,
  UpdateReservationRequest,
  ReservationResponse,
} from './reservations_types.js';
import {
  queueQloAppsAvailabilitySyncHook,
  queueQloAppsReservationSyncHook,
} from '../../integrations/qloapps/hooks/sync_hooks.js';
import { RoomTypeAvailabilityService } from '../room_types/room_type_availability_service.js';
import { logCreate, logUpdate, logDelete, logAction } from '../audit/audit_utils.js';
import { checkInGuest, getEligibleRooms } from '../check_ins/check_ins_service.js';

const availabilityService = new RoomTypeAvailabilityService();

// ============================================================================
// Channel Manager Sync Helper
// ============================================================================

/**
 * Queue reservation sync to QloApps.
 */
async function queueReservationSync(
  reservationId: string,
  action: 'create' | 'update' | 'cancel'
): Promise<void> {
  try {
    await queueQloAppsReservationSyncHook(reservationId, action);
  } catch (error) {
    console.error(`[ReservationController] Failed to queue ${action} sync for ${reservationId}:`, error);
    // Don't rethrow - sync failures shouldn't break reservation operations
  }
}

/**
 * Queue room availability sync to QloApps.
 */
async function queueAvailabilitySync(
  roomTypeId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<void> {
  try {
    const from = dateFrom ?? new Date().toISOString().split('T')[0];
    const to = dateTo ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await queueQloAppsAvailabilitySyncHook(roomTypeId, from as string, to as string);
  } catch (error) {
    console.error(`[ReservationController] Failed to queue availability sync:`, error);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper function to check for overlapping reservations
async function hasOverlappingReservation(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<boolean> {
  const overlapping = await db('reservations')
    .where({ room_id: roomId })
    .whereNotIn('status', ['Cancelled', 'No-show', 'Checked-out'])
    .whereNull('deleted_at')
    .where(function () {
      this.where(function () {
        // Check-in is within existing reservation
        this.where('check_in', '<=', checkIn).where('check_out', '>', checkIn);
      })
        .orWhere(function () {
          // Check-out is within existing reservation
          this.where('check_in', '<', checkOut).where('check_out', '>=', checkOut);
        })
        .orWhere(function () {
          // Reservation completely contains existing reservation
          this.where('check_in', '>=', checkIn).where('check_out', '<=', checkOut);
        })
        .orWhere(function () {
          // Reservation is completely within existing reservation
          this.where('check_in', '<=', checkIn).where('check_out', '>=', checkOut);
        });
    });

  if (excludeReservationId) {
    return overlapping.some((res) => res.id !== excludeReservationId);
  }

  return overlapping.length > 0;
}

// Helper function to calculate total amount
async function calculateTotalAmount(
  roomId: string | null,
  roomTypeId: string | null,
  unitsRequested: number,
  checkIn: Date,
  checkOut: Date,
): Promise<number> {
  let pricePerNight = 0;

  if (roomId) {
    const room = await db('rooms').where({ id: roomId }).first();
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }
    pricePerNight = parseFloat(room.price_per_night);
  } else if (roomTypeId) {
    const roomType = await db('room_types').where({ id: roomTypeId }).whereNull('deleted_at').first();
    if (!roomType) {
      throw new Error(`Room type not found: ${roomTypeId}`);
    }
    pricePerNight = parseFloat(roomType.price_per_night);
  } else {
    throw new Error('Either room_id or room_type_id must be provided');
  }

  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  return pricePerNight * nights * (unitsRequested || 1);
}

// Helper function to resolve assigned_unit_id to physical room number
async function resolveUnitRoomNumbers(
  hotelId: string | undefined,
  reservations: { id: string; room_type_id: string | null; assigned_unit_id: string | null }[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  
  if (!hotelId) return resolved;
  
  // Group by room_type_id to batch queries
  const roomTypesToFetch = new Set<string>();
  for (const res of reservations) {
    if (res.room_type_id && res.assigned_unit_id) {
      roomTypesToFetch.add(res.room_type_id);
    }
  }

  if (roomTypesToFetch.size === 0) {
    return resolved;
  }

  // Fetch all linked rooms ordered by room_number to match unit indices
  const linkedRoomsMatch = await db('rooms')
    .select('room_type_id', 'room_number')
    .where('hotel_id', hotelId)
    .whereIn('room_type_id', Array.from(roomTypesToFetch))
    .orderBy('room_number', 'asc');

  // Map room_type_id -> string[] (physical room numbers in order)
  const roomNumbersByType = new Map<string, string[]>();
  for (const room of linkedRoomsMatch) {
    if (!room.room_type_id || !room.room_number) continue;
    
    if (!roomNumbersByType.has(room.room_type_id)) {
      roomNumbersByType.set(room.room_type_id, []);
    }
    roomNumbersByType.get(room.room_type_id)!.push(room.room_number);
  }

  // Resolve each reservation
  for (const res of reservations) {
    if (!res.room_type_id || !res.assigned_unit_id) continue;
    
    const match = res.assigned_unit_id.match(/-(?:unit|-)(\d+)$/i);
    if (!match) continue;
    
    const unitIndex = parseInt(match[1] as string, 10);
    if (isNaN(unitIndex)) continue;

    const linkedRooms = roomNumbersByType.get(res.room_type_id);
    if (linkedRooms && linkedRooms.length > unitIndex) {
      resolved.set(res.id, linkedRooms[unitIndex] as string);
    }
  }

  return resolved;
}

async function autoCreateCheckInFromLegacyStatus(
  reservationId: string,
  hotelId: string,
  preferredRoomId: string | null,
  userId?: string,
): Promise<void> {
  const reservation = await db('reservations')
    .where({ id: reservationId, hotel_id: hotelId })
    .whereNull('deleted_at')
    .first();

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.checkin_id) {
    return;
  }

  // checkInGuest accepts only Confirmed reservations.
  if (reservation.status !== 'Confirmed') {
    await db('reservations').where({ id: reservationId }).update({
      status: 'Confirmed',
      updated_at: db.fn.now(),
    });
  }

  let actualRoomId = preferredRoomId || reservation.room_id || null;
  if (!actualRoomId) {
    const eligibleRooms = await getEligibleRooms(reservationId, hotelId);
    if (eligibleRooms.available_rooms.length === 0) {
      throw new Error('No available rooms for this reservation');
    }

    const matchedRoom = eligibleRooms.reserved_room_id
      ? eligibleRooms.available_rooms.find((room) => room.id === eligibleRooms.reserved_room_id)
      : null;
    actualRoomId = matchedRoom?.id || eligibleRooms.available_rooms[0]?.id || null;
  }

  if (!actualRoomId) {
    throw new Error('No room could be assigned for check-in');
  }

  await checkInGuest(
    {
      reservation_id: reservationId,
      actual_room_id: actualRoomId,
      notes: 'Auto check-in from legacy reservation status',
    },
    hotelId,
    userId,
  );
}

function getLegacyCheckedInErrorStatus(message: string): number {
  if (message.includes('not found')) {
    return 404;
  }

  if (
    message.includes('scheduled arrival') ||
    message.includes('Hotel local date') ||
    message.includes('before scheduled')
  ) {
    return 400;
  }

  return 409;
}

function getLegacyCheckedInErrorMessage(message: string): string {
  if (
    message.includes('scheduled arrival') ||
    message.includes('Hotel local date') ||
    message.includes('before scheduled')
  ) {
    return 'Cannot mark reservation as Checked-in before the scheduled arrival date. Save it as Confirmed and complete check-in on the arrival date.';
  }

  return message;
}

// Get all reservations
export async function getReservationsHandler(
  req: Request,
  res: Response<ReservationResponse[]>,
  next: NextFunction,
) {
  try {
    const { status, search, check_in, check_out } = req.query;
    const hotelId = (req as any).hotelId;

    let query = db('reservations')
      .select(
        'reservations.*',
        'rooms.room_number',
        'room_types.name as room_type_name',
        'room_types.room_type as room_type',
        'primary_guest.name as primary_guest_name',
        'primary_guest.email as primary_guest_email',
        'primary_guest.phone as primary_guest_phone',
      )
      .leftJoin('rooms', 'reservations.room_id', 'rooms.id')
      .leftJoin('room_types', 'reservations.room_type_id', 'room_types.id')
      .join('guests as primary_guest', 'reservations.primary_guest_id', 'primary_guest.id')
      .where('reservations.hotel_id', hotelId)
      .whereNull('reservations.deleted_at')
      .orderBy('reservations.created_at', 'desc');

    if (status) {
      const raw = status as string;
      const statuses = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.where('reservations.status', statuses[0]!);
      } else if (statuses.length > 1) {
        query = query.whereIn('reservations.status', statuses);
      }
    }

    if (check_in) {
      query = query.where('reservations.check_in', '>=', check_in as string);
    }

    if (check_out) {
      query = query.where('reservations.check_out', '<=', check_out as string);
    }

    if (search) {
      query = query.where(function () {
        this.where('rooms.room_number', 'ilike', `%${search}%`)
          .orWhere('room_types.name', 'ilike', `%${search}%`)
          .orWhere('primary_guest.name', 'ilike', `%${search}%`)
          .orWhere('reservations.id', 'ilike', `%${search}%`);
      });
    }

    const reservations = await query;

    // Resolve room numbers for unit-assigned reservations
    const resolvedRoomNumbers = await resolveUnitRoomNumbers(hotelId, reservations.map(r => ({
      id: r.id,
      room_type_id: r.room_type_id,
      assigned_unit_id: r.assigned_unit_id,
    })));

    // Get secondary guests for reservations that have them
    const reservationIds = reservations.map((r) => r.id);
    const secondaryGuests = await db('reservation_guests')
      .select('reservation_guests.*', 'guests.name', 'guests.email', 'guests.phone')
      .join('guests', 'reservation_guests.guest_id', 'guests.id')
      .whereIn('reservation_guests.reservation_id', reservationIds)
      .where('reservation_guests.guest_type', 'Secondary');

    // Map secondary guests to reservations
    const reservationsWithGuests = reservations.map((res) => {
      const secondary = secondaryGuests.find((sg) => sg.reservation_id === res.id);
      return {
        id: res.id,
        room_id: res.room_id,
        room_type_id: res.room_type_id,
        room_number: res.room_number || resolvedRoomNumbers.get(res.id) || res.room_type_name,
        room_type_name: res.room_type_name,
        assigned_unit_id: res.assigned_unit_id || null,
        units_requested: res.units_requested || 1,
        primary_guest_id: res.primary_guest_id,
        primary_guest_name: res.primary_guest_name,
        primary_guest_email: res.primary_guest_email,
        primary_guest_phone: res.primary_guest_phone,
        secondary_guest_id: secondary?.guest_id,
        secondary_guest_name: secondary?.name,
        secondary_guest_email: secondary?.email,
        secondary_guest_phone: secondary?.phone,
        check_in: res.check_in,
        check_out: res.check_out,
        status: res.status,
        total_amount: parseFloat(res.total_amount),
        source: res.source,
        beds24_booking_id: res.beds24_booking_id,
        special_requests: res.special_requests,
        created_at: res.created_at,
        updated_at: res.updated_at,
        checkin_id: res.checkin_id || null,
      };
    });

    res.json(reservationsWithGuests as any);
  } catch (error) {
    next(error);
  }
}

// Get single reservation
export async function getReservationHandler(
  req: Request<{ id: string }>,
  res: Response<ReservationResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const hotelId = (req as any).hotelId;

    const reservation = await db('reservations')
      .select(
        'reservations.*',
        'rooms.room_number',
        'room_types.name as room_type_name',
        'room_types.room_type as room_type',
        'primary_guest.name as primary_guest_name',
        'primary_guest.email as primary_guest_email',
        'primary_guest.phone as primary_guest_phone',
      )
      .leftJoin('rooms', 'reservations.room_id', 'rooms.id')
      .leftJoin('room_types', 'reservations.room_type_id', 'room_types.id')
      .join('guests as primary_guest', 'reservations.primary_guest_id', 'primary_guest.id')
      .where('reservations.id', id)
      .where('reservations.hotel_id', hotelId)
      .whereNull('reservations.deleted_at')
      .first();

    if (!reservation) {
      res.status(404).json({
        error: 'Reservation not found',
      } as any);
      return;
    }

    // Resolve room number for unit-assigned reservation
    const resolvedRoomNumbers = await resolveUnitRoomNumbers(hotelId, [{
      id: reservation.id,
      room_type_id: reservation.room_type_id,
      assigned_unit_id: reservation.assigned_unit_id,
    }]);

    // Get secondary guest if exists
    const secondaryGuest = await db('reservation_guests')
      .select('reservation_guests.guest_id', 'guests.name', 'guests.email', 'guests.phone')
      .join('guests', 'reservation_guests.guest_id', 'guests.id')
      .where('reservation_guests.reservation_id', id)
      .where('reservation_guests.guest_type', 'Secondary')
      .first();

    const response: ReservationResponse = {
      id: reservation.id,
      room_id: reservation.room_id,
      room_type_id: reservation.room_type_id,
      room_number: reservation.room_number || resolvedRoomNumbers.get(reservation.id) || reservation.room_type_name || null,
      room_type_name: reservation.room_type_name,
      assigned_unit_id: reservation.assigned_unit_id || null,
      units_requested: reservation.units_requested || 1,
      primary_guest_id: reservation.primary_guest_id,
      primary_guest_name: reservation.primary_guest_name,
      primary_guest_email: reservation.primary_guest_email,
      primary_guest_phone: reservation.primary_guest_phone,
      secondary_guest_id: secondaryGuest?.guest_id,
      secondary_guest_name: secondaryGuest?.name,
      secondary_guest_email: secondaryGuest?.email,
      secondary_guest_phone: secondaryGuest?.phone,
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      status: reservation.status,
      total_amount: parseFloat(reservation.total_amount),
      source: reservation.source,
      beds24_booking_id: reservation.beds24_booking_id,
      special_requests: reservation.special_requests,
      created_at: reservation.created_at,
      updated_at: reservation.updated_at,
      checkin_id: reservation.checkin_id || null,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

// Create reservation
export async function createReservationHandler(
  req: Request<{}, ReservationResponse, CreateReservationRequest>,
  res: Response<ReservationResponse>,
  next: NextFunction,
) {
  try {
    const hotelId = (req as any).hotelId;
    const userId = (req as any).user?.userId as string | undefined;
    const {
      room_id, // Legacy: individual room
      room_type_id, // New: room type
      assigned_unit_id,
      units_requested = 1,
      primary_guest_id,
      secondary_guest_id,
      check_in,
      check_out,
      status = 'Confirmed',
      source = 'Direct',
      special_requests,
      force = false,
    } = req.body;

    // Validation: require either room_id (legacy) or room_type_id (new)
    if ((!room_id && !room_type_id) || !check_in || !check_out) {
      res.status(400).json({
        error: 'Either room_id or room_type_id, check_in, and check_out are required',
      } as any);
      return;
    }

    // Handle missing guest - use "Unknown Guest" if not provided
    let finalGuestId = primary_guest_id;
    if (!finalGuestId) {
      // Find or create "Unknown Guest"
      const { QloAppsGuestMatchingService } = await import(
        '../../integrations/qloapps/services/guest_matching_service.js'
      );
      const guestMatchingService = new QloAppsGuestMatchingService();
      finalGuestId = await guestMatchingService.getUnknownGuestId();
    }

    // Validate date string format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out)) {
      res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      } as any);
      return;
    }

    // Create Date objects with explicit UTC for calculations only
    // Append T00:00:00.000Z to force UTC interpretation and avoid timezone offset bugs
    const checkInDate = new Date(check_in + 'T00:00:00.000Z');
    const checkOutDate = new Date(check_out + 'T00:00:00.000Z');

    if (checkOutDate <= checkInDate) {
      res.status(400).json({
        error: 'check_out must be after check_in',
      } as any);
      return;
    }

    // Handle room_type_id (new Beds24-style) or room_id (legacy)
    let roomTypeId: string | null = null;
    let roomId: string | null = null;
    let pricePerNight = 0;

    if (room_type_id) {
      // New: Room type based reservation
      const roomType = await db('room_types').where({ id: room_type_id }).whereNull('deleted_at').first();
      if (!roomType) {
        res.status(404).json({
          error: 'Room type not found',
        } as any);
        return;
      }
      roomTypeId = room_type_id;
      pricePerNight = parseFloat(roomType.price_per_night);

      // Check availability for room type
      if (!force) {
        const hasAvailability = await availabilityService.hasAvailability(
          room_type_id,
          checkInDate,
          checkOutDate,
          units_requested
        );
        if (!hasAvailability) {
          res.status(409).json({
            error: `Not enough units available. Requested: ${units_requested}`,
          } as any);
          return;
        }
      }
    } else if (room_id) {
      // Legacy: Individual room based reservation
      const room = await db('rooms').where({ id: room_id }).first();
      if (!room) {
        res.status(404).json({
          error: 'Room not found',
        } as any);
        return;
      }
      roomId = room_id;
      pricePerNight = parseFloat(room.price_per_night);

      // Check for overlapping reservations (unless force is true)
      if (!force) {
        const hasOverlap = await hasOverlappingReservation(room_id, checkInDate, checkOutDate);
        if (hasOverlap) {
          res.status(409).json({
            error: 'Room already has a reservation during this period',
          } as any);
          return;
        }
      }
    }

    // Check if primary guest exists (using finalGuestId which may be Unknown Guest)
    const primaryGuest = await db('guests').where({ id: finalGuestId }).first();
    if (!primaryGuest) {
      res.status(404).json({
        error: 'Primary guest not found',
      } as any);
      return;
    }

    // Calculate total amount
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = pricePerNight * nights * units_requested;

    // Create reservation in transaction
    const reservation = await db.transaction(async (trx) => {
      // Create reservation
      const [newReservation] = await trx('reservations')
        .insert({
          hotel_id: hotelId,
          room_id: roomId, // Legacy: nullable
          room_type_id: roomTypeId, // New: nullable
          assigned_unit_id: assigned_unit_id || null,
          units_requested: units_requested || 1,
          primary_guest_id: finalGuestId,
          check_in: check_in,  // Store string directly, no conversion to avoid timezone issues
          check_out: check_out,  // Store string directly, no conversion to avoid timezone issues
          status,
          total_amount: totalAmount,
          source,
          special_requests,
        })
        .returning('*');

      // Create primary guest link
      await trx('reservation_guests').insert({
        reservation_id: newReservation.id,
        guest_id: finalGuestId,
        guest_type: 'Primary',
        hotel_id: hotelId,
      });

      // Create secondary guest link if provided
      if (secondary_guest_id) {
        const secondaryGuest = await trx('guests').where({ id: secondary_guest_id }).first();
        if (!secondaryGuest) {
          throw new Error('Secondary guest not found');
        }

        await trx('reservation_guests').insert({
          reservation_id: newReservation.id,
          guest_id: secondary_guest_id,
          guest_type: 'Secondary',
          hotel_id: hotelId,
        });
      }

      return newReservation;
    });

    if (status === 'Checked-in') {
      console.warn(
        `[Reservation] Legacy create with status=Checked-in for ${reservation.id}. Auto-creating check-in linkage.`,
      );
      try {
        await autoCreateCheckInFromLegacyStatus(reservation.id, hotelId, roomId, userId);
      } catch (legacyCheckInError: any) {
        // Compensate to avoid leaving a partially successful API intent.
        await db('reservations').where({ id: reservation.id }).update({
          status: 'Cancelled',
          deleted_at: new Date(),
          updated_at: db.fn.now(),
        });

        const rawMessage =
          legacyCheckInError?.message || 'Failed to complete legacy Checked-in reservation flow';
        const statusCode = getLegacyCheckedInErrorStatus(rawMessage);
        const publicMessage = getLegacyCheckedInErrorMessage(rawMessage);

        res.status(statusCode).json({
          error: publicMessage,
          code: 'LEGACY_CHECKIN_FAILED',
        } as any);
        return;
      }
    }

    // Fetch full reservation with guest details
    const fullReservation = await db('reservations')
      .select(
        'reservations.*',
        'rooms.room_number',
        'room_types.name as room_type_name',
        'room_types.room_type as room_type',
        'primary_guest.name as primary_guest_name',
        'primary_guest.email as primary_guest_email',
        'primary_guest.phone as primary_guest_phone',
      )
      .leftJoin('rooms', 'reservations.room_id', 'rooms.id')
      .leftJoin('room_types', 'reservations.room_type_id', 'room_types.id')
      .join('guests as primary_guest', 'reservations.primary_guest_id', 'primary_guest.id')
      .where('reservations.id', reservation.id)
      .first();

    // Resolve room number for unit-assigned reservation
    const resolvedRoomNumbers = await resolveUnitRoomNumbers(hotelId, [{
      id: fullReservation.id,
      room_type_id: fullReservation.room_type_id,
      assigned_unit_id: fullReservation.assigned_unit_id,
    }]);

    // Get secondary guest if exists
    const secondaryGuest = await db('reservation_guests')
      .select('reservation_guests.guest_id', 'guests.name', 'guests.email', 'guests.phone')
      .join('guests', 'reservation_guests.guest_id', 'guests.id')
      .where('reservation_guests.reservation_id', reservation.id)
      .where('reservation_guests.guest_type', 'Secondary')
      .first();

    const response: ReservationResponse = {
      id: fullReservation.id,
      room_id: fullReservation.room_id,
      room_type_id: fullReservation.room_type_id,
      room_number: fullReservation.room_number || resolvedRoomNumbers.get(fullReservation.id) || fullReservation.room_type_name || null,
      room_type_name: fullReservation.room_type_name,
      assigned_unit_id: fullReservation.assigned_unit_id || null,
      units_requested: fullReservation.units_requested || 1,
      primary_guest_id: fullReservation.primary_guest_id,
      primary_guest_name: fullReservation.primary_guest_name,
      primary_guest_email: fullReservation.primary_guest_email,
      primary_guest_phone: fullReservation.primary_guest_phone,
      secondary_guest_id: secondaryGuest?.guest_id,
      secondary_guest_name: secondaryGuest?.name,
      secondary_guest_email: secondaryGuest?.email,
      secondary_guest_phone: secondaryGuest?.phone,
      check_in: fullReservation.check_in,
      check_out: fullReservation.check_out,
      status: fullReservation.status,
      total_amount: parseFloat(fullReservation.total_amount),
      source: fullReservation.source,
      beds24_booking_id: fullReservation.beds24_booking_id,
      special_requests: fullReservation.special_requests,
      created_at: fullReservation.created_at,
      updated_at: fullReservation.updated_at,
      checkin_id: fullReservation.checkin_id || null,
    };

    res.status(201).json(response);

    // Audit log: reservation created
    logCreate(req, 'reservation', reservation.id, {
      room_type_id: roomTypeId,
      room_id: roomId,
      guest_name: fullReservation.primary_guest_name,
      check_in,
      check_out,
      status,
      total_amount: totalAmount,
      source,
    }).catch((err) => console.error('Audit log failed:', err));

    // Queue sync to active channel manager (non-blocking, fire-and-forget)
    // This ensures reservations created in PMS are synced to the channel manager (QloApps)
    queueReservationSync(reservation.id, 'create').catch((err) => {
      console.error(
        `[ReservationController] Failed to queue sync for reservation ${reservation.id}:`,
        err
      );
    });
  } catch (error) {
    next(error);
  }
}

// Update reservation
export async function updateReservationHandler(
  req: Request<{ id: string }, ReservationResponse, UpdateReservationRequest>,
  res: Response<ReservationResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.userId as string | undefined;

    // Check if reservation exists
    const existing = await db('reservations')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      res.status(404).json({
        error: 'Reservation not found',
      } as any);
      return;
    }

    const terminalStatuses = ['Checked-out', 'Cancelled', 'No-show'];
    if (terminalStatuses.includes(existing.status)) {
      const blockedKeys = [
        'check_in',
        'check_out',
        'room_id',
        'room_type_id',
        'assigned_unit_id',
        'units_requested',
        'status',
      ] as const;
      const touched = blockedKeys.filter((k) => (updates as Record<string, unknown>)[k] !== undefined);
      if (touched.length > 0) {
        res.status(409).json({
          error:
            'This reservation is closed; dates, room, unit, and status cannot be changed. Special requests may still be updated.',
        } as any);
        return;
      }
    }

    if (
      existing.status === 'Checked-in' &&
      (updates.check_in !== undefined ||
        updates.check_out !== undefined ||
        updates.room_id !== undefined)
    ) {
      res.status(409).json({
        error:
          'Cannot change check-in/out dates or assigned room while checked in. Use the Check-ins API for room moves.',
      } as any);
      return;
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    // Keep dates as strings, only create Date objects with explicit UTC for validation
    let checkInDate = existing.check_in ? new Date(existing.check_in + 'T00:00:00.000Z') : null;
    let checkOutDate = existing.check_out ? new Date(existing.check_out + 'T00:00:00.000Z') : null;
    let roomId = existing.room_id || null;
    let roomTypeId = existing.room_type_id || null;
    let unitsRequested = existing.units_requested || 1;

    if (updates.check_in) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.check_in)) {
        res.status(400).json({
          error: 'Invalid check_in date format. Use YYYY-MM-DD',
        } as any);
        return;
      }
      checkInDate = new Date(updates.check_in + 'T00:00:00.000Z');
      updateData.check_in = updates.check_in;  // Store string directly
    }

    if (updates.check_out) {
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.check_out)) {
        res.status(400).json({
          error: 'Invalid check_out date format. Use YYYY-MM-DD',
        } as any);
        return;
      }
      checkOutDate = new Date(updates.check_out + 'T00:00:00.000Z');
      updateData.check_out = updates.check_out;  // Store string directly
    }

    if (updates.room_id !== undefined) {
      roomId = updates.room_id;
      updateData.room_id = updates.room_id;
    }

    if (updates.room_type_id !== undefined) {
      roomTypeId = updates.room_type_id;
      updateData.room_type_id = updates.room_type_id;
    }

    if (updates.units_requested !== undefined) {
      if (!Number.isInteger(updates.units_requested) || updates.units_requested < 1) {
        res.status(400).json({
          error: 'units_requested must be a positive integer',
        } as any);
        return;
      }
      unitsRequested = updates.units_requested;
      updateData.units_requested = updates.units_requested;
    }

    if (updates.status !== undefined) {
      const allowedStatuses = ['Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'No-show'];
      if (!allowedStatuses.includes(updates.status)) {
        res.status(400).json({
          error: 'Invalid reservation status',
        } as any);
        return;
      }
      if (updates.status === 'No-show' && existing.status !== 'Confirmed') {
        res.status(409).json({
          error: 'No-show can only be set from Confirmed reservations',
        } as any);
        return;
      }
      updateData.status = updates.status;
    }

    if (updates.special_requests !== undefined) {
      updateData.special_requests = updates.special_requests;
    }

    // Validate dates if both are provided
    if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
      res.status(400).json({
        error: 'check_out must be after check_in',
      } as any);
      return;
    }

    if (!roomId && !roomTypeId) {
      res.status(400).json({
        error: 'Reservation must have either room_id or room_type_id',
      } as any);
      return;
    }

    if (roomId && roomTypeId) {
      res.status(400).json({
        error: 'Reservation cannot have both room_id and room_type_id',
      } as any);
      return;
    }

    // Check for overlapping reservations if dates or room changed
    if (
      (
        updates.check_in ||
        updates.check_out ||
        updates.room_id !== undefined ||
        updates.room_type_id !== undefined ||
        updates.units_requested !== undefined
      ) &&
      checkInDate &&
      checkOutDate
    ) {
      if (roomId) {
        const hasOverlap = await hasOverlappingReservation(roomId, checkInDate, checkOutDate, id);
        if (hasOverlap) {
          res.status(409).json({
            error: 'Room already has a reservation during this period',
          } as any);
          return;
        }
      } else if (roomTypeId) {
        const hasAvailability = await availabilityService.hasAvailability(
          roomTypeId,
          checkInDate,
          checkOutDate,
          unitsRequested,
          id,
        );
        if (!hasAvailability) {
          res.status(409).json({
            error: `Not enough units available. Requested: ${unitsRequested}`,
          } as any);
          return;
        }
      }

      // Recalculate total amount if dates or room changed
      const totalAmount = await calculateTotalAmount(
        roomId,
        roomTypeId,
        unitsRequested,
        checkInDate,
        checkOutDate,
      );
      updateData.total_amount = totalAmount;
    }

    // Update reservation in transaction
    await db.transaction(async (trx) => {
      await trx('reservations').where({ id }).update(updateData);

      // ⚠️ LEGACY: Update room status based on reservation status (backward compatibility)
      // DEPRECATION WARNING: This direct status update is maintained for backward compatibility.
      // For new implementations, use the Check-ins API instead:
      //   - Check-in: POST /api/v1/reservations/:id/check-in
      //   - Check-out: PATCH /api/v1/check-ins/:id/checkout
      //   - Room change: POST /api/v1/check-ins/:id/change-room
      if (updates.status && roomId) {
        const room = await trx('rooms').where({ id: roomId }).first();
        if (room) {
          if (updates.status === 'Checked-out') {
            console.warn(
              `[Reservation] DEPRECATED: PUT reservation status=Checked-out for ${id}. Use PATCH /api/v1/check-ins/:id/checkout instead.`,
            );
            await trx('rooms').where({ id: roomId }).update({ status: 'Cleaning' });
            await trx('housekeeping')
              .where({ room_id: roomId })
              .update({ status: 'Dirty', updated_at: new Date() });
          } else if (
            (updates.status === 'Cancelled' || updates.status === 'No-show') &&
            room.status === 'Occupied'
          ) {
            await trx('rooms').where({ id: roomId }).update({ status: 'Available' });
          }
        }
      }
    });

    if (updates.status === 'Checked-in') {
      console.warn(
        `[Reservation] Legacy update with status=Checked-in for ${id}. Auto-creating check-in linkage.`,
      );
      try {
        await autoCreateCheckInFromLegacyStatus(id, existing.hotel_id, roomId, userId);
      } catch (legacyCheckInError: any) {
        await db('reservations').where({ id }).update({
          status: existing.status,
          checkin_id: existing.checkin_id || null,
          updated_at: db.fn.now(),
        });

        const rawMessage =
          legacyCheckInError?.message || 'Failed to complete legacy Checked-in update flow';
        const statusCode = getLegacyCheckedInErrorStatus(rawMessage);
        const publicMessage = getLegacyCheckedInErrorMessage(rawMessage);

        res.status(statusCode).json({
          error: publicMessage,
          code: 'LEGACY_CHECKIN_FAILED',
        } as any);
        return;
      }
    }

    if (updates.status === 'No-show' && existing.status === 'Confirmed') {
      logAction(req, 'RESERVATION_NO_SHOW', 'reservation', id, {
        description: 'Reservation marked as No-show',
      }).catch((err) => console.error('Audit log failed:', err));
    }

    // Queue channel manager sync (non-blocking)
    queueReservationSync(id, 'update').catch((err) => {
      console.error('Failed to queue reservation sync:', err);
    });

    // Sync room availability if room or dates changed
    if (
      updates.room_id !== undefined ||
      updates.room_type_id !== undefined ||
      updates.check_in ||
      updates.check_out ||
      updates.units_requested !== undefined
    ) {
      // Get room type ID for availability sync
      const syncRoomTypeId = roomTypeId || existing.room_type_id;
      if (syncRoomTypeId) {
        queueAvailabilitySync(syncRoomTypeId).catch((err) => {
          console.error('Failed to queue room availability sync:', err);
        });
      }
    }

    // Fetch updated reservation
    const updated = await db('reservations')
      .select(
        'reservations.*',
        'rooms.room_number',
        'room_types.name as room_type_name',
        'room_types.room_type as room_type',
        'primary_guest.name as primary_guest_name',
        'primary_guest.email as primary_guest_email',
        'primary_guest.phone as primary_guest_phone',
      )
      .leftJoin('rooms', 'reservations.room_id', 'rooms.id')
      .leftJoin('room_types', 'reservations.room_type_id', 'room_types.id')
      .join('guests as primary_guest', 'reservations.primary_guest_id', 'primary_guest.id')
      .where('reservations.id', id)
      .first();

    // Resolve room number for unit-assigned reservation
    const resolvedRoomNumbers = await resolveUnitRoomNumbers(updated.hotel_id, [{
      id: updated.id,
      room_type_id: updated.room_type_id,
      assigned_unit_id: updated.assigned_unit_id,
    }]);

    // Get secondary guest
    const secondaryGuest = await db('reservation_guests')
      .select('reservation_guests.guest_id', 'guests.name', 'guests.email', 'guests.phone')
      .join('guests', 'reservation_guests.guest_id', 'guests.id')
      .where('reservation_guests.reservation_id', id)
      .where('reservation_guests.guest_type', 'Secondary')
      .first();

    const response: ReservationResponse = {
      id: updated.id,
      room_id: updated.room_id,
      room_type_id: updated.room_type_id,
      room_number: updated.room_number || resolvedRoomNumbers.get(updated.id) || updated.room_type_name,
      room_type_name: updated.room_type_name,
      assigned_unit_id: updated.assigned_unit_id || null,
      units_requested: updated.units_requested || 1,
      primary_guest_id: updated.primary_guest_id,
      primary_guest_name: updated.primary_guest_name,
      primary_guest_email: updated.primary_guest_email,
      primary_guest_phone: updated.primary_guest_phone,
      secondary_guest_id: secondaryGuest?.guest_id,
      secondary_guest_name: secondaryGuest?.name,
      secondary_guest_email: secondaryGuest?.email,
      secondary_guest_phone: secondaryGuest?.phone,
      check_in: updated.check_in,
      check_out: updated.check_out,
      status: updated.status,
      total_amount: parseFloat(updated.total_amount),
      source: updated.source,
      beds24_booking_id: updated.beds24_booking_id,
      special_requests: updated.special_requests,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      checkin_id: updated.checkin_id || null,
    };

    res.json(response);

    // Audit log: reservation updated
    logUpdate(req, 'reservation', id, {
      check_in: existing.check_in,
      check_out: existing.check_out,
      status: existing.status,
      room_id: existing.room_id,
    }, {
      check_in: updated.check_in,
      check_out: updated.check_out,
      status: updated.status,
      room_id: updated.room_id,
    }).catch((err) => console.error('Audit log failed:', err));
  } catch (error) {
    next(error);
  }
}

// Delete reservation (soft delete)
export async function deleteReservationHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const reservation = await db('reservations')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!reservation) {
      res.status(404).json({
        error: 'Reservation not found',
      });
      return;
    }

    // Soft delete
    await db('reservations').where({ id }).update({
      deleted_at: new Date(),
      status: 'Cancelled',
    });

    // Update room status if it was occupied
    if (reservation.status === 'Checked-in') {
      await db('rooms').where({ id: reservation.room_id }).update({ status: 'Available' });
    }

    // Queue channel manager sync for cancellation (non-blocking)
    queueReservationSync(id, 'cancel').catch((err) => {
      console.error('Failed to queue reservation cancel sync:', err);
    });

    // Sync room availability
    if (reservation.room_type_id) {
      queueAvailabilitySync(reservation.room_type_id).catch((err) => {
        console.error('Failed to queue room availability sync:', err);
      });
    }

    res.status(204).send();

    // Audit log: reservation deleted/cancelled
    logDelete(req, 'reservation', id, {
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      status: reservation.status,
      room_id: reservation.room_id,
      primary_guest_id: reservation.primary_guest_id,
      total_amount: reservation.total_amount,
    }).catch((err) => console.error('Audit log failed:', err));
  } catch (error) {
    next(error);
  }
}

// Check room availability
export async function checkAvailabilityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { check_in, check_out, room_id } = req.query;

    if (!check_in || !check_out) {
      res.status(400).json({
        error: 'check_in and check_out are required',
      });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(check_in as string) || !/^\d{4}-\d{2}-\d{2}$/.test(check_out as string)) {
      res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
      return;
    }

    // Create Date objects with explicit UTC for validation only
    const checkInDate = new Date((check_in as string) + 'T00:00:00.000Z');
    const checkOutDate = new Date((check_out as string) + 'T00:00:00.000Z');

    if (checkOutDate <= checkInDate) {
      res.status(400).json({
        error: 'check_out must be after check_in',
      });
      return;
    }

    // Use string dates directly in queries to avoid timezone issues
    let query = db('rooms')
      .select('rooms.*')
      .leftJoin('reservations', function () {
        this.on('rooms.id', '=', 'reservations.room_id')
          .andOn('reservations.check_in', '<', db.raw('?', [check_out as any]))
          .andOn('reservations.check_out', '>', db.raw('?', [check_in as any]))
          .andOn('reservations.status', '!=', db.raw('?', ['Cancelled']))
          .andOnNull('reservations.deleted_at');
      })
      .whereNull('reservations.id')
      .where('rooms.status', '!=', 'Out of Service');

    if (room_id) {
      query = query.where('rooms.id', room_id as string);
    }

    const availableRooms = await query;

    res.json({
      available: availableRooms.length > 0,
      rooms: availableRooms,
      check_in: check_in,
      check_out: check_out,
    });
  } catch (error) {
    next(error);
  }
}

