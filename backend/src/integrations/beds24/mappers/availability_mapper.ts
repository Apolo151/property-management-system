import type {
  Beds24CalendarDay,
  Beds24CalendarUpdate,
} from '../beds24_types.js';
import type { RoomResponse } from '../../../services/rooms/rooms_types.js';
import db from '../../../config/database.js';

/**
 * Date range for availability sync
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Calculate room availability for a date range
 * Returns number of available units per day
 * Supports both individual rooms (legacy) and room types (new)
 */
export async function calculateRoomAvailability(
  roomId: string,
  dateRange: DateRange,
  isRoomType: boolean = false
): Promise<Map<string, number>> {
  const availability = new Map<string, number>();

  // Try room type first (new), then individual room (legacy)
  let room: any = null;
  let totalUnits = 1;

  if (isRoomType) {
    room = await db('room_types').where({ id: roomId }).whereNull('deleted_at').first();
    if (room) {
      totalUnits = room.qty || 1;
    }
  } else {
    // Try individual room first (legacy)
    room = await db('rooms').where({ id: roomId }).first();
    if (!room) {
      // Fallback: try as room type
      room = await db('room_types').where({ id: roomId }).whereNull('deleted_at').first();
      if (room) {
        totalUnits = room.qty || 1;
        isRoomType = true;
      }
    }
  }

  if (!room) {
    throw new Error(`Room or room type ${roomId} not found`);
  }

  // Get all reservations for this room/room type in the date range
  const reservationQuery = isRoomType
    ? db('reservations').where({ room_type_id: roomId })
    : db('reservations').where({ room_id: roomId });

  const reservations = await reservationQuery
    .whereNotIn('status', ['Cancelled', 'Checked-out'])
    .whereNull('deleted_at')
    .where(function () {
      this.where('check_in', '<=', dateRange.endDate.toISOString().split('T')[0])
        .where('check_out', '>', dateRange.startDate.toISOString().split('T')[0]);
    })
    .select('check_in', 'check_out', 'status', 'units_requested');

  // Get maintenance/out-of-service periods
  // Note: maintenance_requests might still use room_id, so we check both
  const maintenanceQuery = isRoomType
    ? db('maintenance_requests').where({ room_type_id: roomId })
    : db('maintenance_requests').where({ room_id: roomId });

  const maintenance = await maintenanceQuery
    .where('status', '!=', 'Completed')
    .where(function () {
      this.where('start_date', '<=', dateRange.endDate.toISOString().split('T')[0])
        .where('end_date', '>=', dateRange.startDate.toISOString().split('T')[0]);
    })
    .select('start_date', 'end_date', 'status', 'affected_units');

  // Get housekeeping out-of-order status (only for individual rooms, not room types)
  let housekeeping: any[] = [];
  if (!isRoomType) {
    housekeeping = await db('housekeeping')
      .where({ room_id: roomId })
      .where('status', 'Out of Service')
      .where('date', '>=', dateRange.startDate.toISOString().split('T')[0])
      .where('date', '<=', dateRange.endDate.toISOString().split('T')[0])
      .select('date');
  }

  // Calculate availability for each day
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    let availableUnits = totalUnits;

    // Subtract reserved units (count units_requested, not just reservation count)
    const reservedUnitsOnDate = reservations
      .filter((res) => {
        const checkIn = new Date(res.check_in);
        const checkOut = new Date(res.check_out);
        return currentDate >= checkIn && currentDate < checkOut;
      })
      .reduce((sum, res) => sum + (res.units_requested || 1), 0);
    availableUnits -= reservedUnitsOnDate;

    // Subtract maintenance units (count affected_units if available)
    const maintenanceUnitsOnDate = maintenance
      .filter((maint) => {
        const startDate = new Date(maint.start_date);
        const endDate = new Date(maint.end_date);
        return currentDate >= startDate && currentDate <= endDate;
      })
      .reduce((sum, maint) => sum + (maint.affected_units || 1), 0);
    availableUnits -= maintenanceUnitsOnDate;

    // Subtract housekeeping out-of-order
    const housekeepingOnDate = housekeeping.filter((h) => {
      const hDate = new Date(h.date);
      return hDate.toISOString().split('T')[0] === dateStr;
    }).length;
    availableUnits -= housekeepingOnDate;

    // Ensure non-negative
    availability.set(dateStr, Math.max(0, availableUnits));

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return availability;
}

/**
 * Map PMS room availability to Beds24 calendar format
 * Supports both individual rooms (legacy) and room types (new)
 */
export async function mapPmsAvailabilityToBeds24(
  room: RoomResponse | any, // Can be RoomResponse or room type
  dateRange: DateRange,
  beds24RoomId: string
): Promise<Beds24CalendarUpdate> {
  // Determine if this is a room type (has qty field) or individual room
  const isRoomType = 'qty' in room && room.qty !== undefined;
  
  // Calculate availability
  const availability = await calculateRoomAvailability(room.id, dateRange, isRoomType);

  // Build calendar data
  const calendarData: Record<string, Partial<Beds24CalendarDay>> = {};

  availability.forEach((numAvail, dateStr) => {
    calendarData[dateStr] = {
      numAvail,
    };
  });

  return {
    roomId: parseInt(beds24RoomId, 10),
    startDate: dateRange.startDate.toISOString().split('T')[0],
    endDate: dateRange.endDate.toISOString().split('T')[0],
    data: calendarData,
  };
}

/**
 * Map PMS room rates to Beds24 calendar format
 */
export async function mapPmsRatesToBeds24(
  room: RoomResponse,
  dateRange: DateRange,
  beds24RoomId: string
): Promise<Beds24CalendarUpdate> {
  const calendarData: Record<string, Partial<Beds24CalendarDay>> = {};

  // For now, use room's base price_per_night for all dates
  // TODO: Implement seasonal rates, day-of-week rates, etc.
  const currentDate = new Date(dateRange.startDate);
  while (currentDate <= dateRange.endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    calendarData[dateStr] = {
      prices: {
        default: Number(room.price_per_night),
      },
    };

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    roomId: parseInt(beds24RoomId, 10),
    startDate: dateRange.startDate.toISOString().split('T')[0],
    endDate: dateRange.endDate.toISOString().split('T')[0],
    data: calendarData,
  };
}

/**
 * Get default date range for availability sync (today + 365 days)
 */
export function getDefaultDateRange(): DateRange {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 365); // 1 year ahead

  return { startDate, endDate };
}

