import db from '../../config/database.js';
import type {
  RoomTypeAvailability,
  RoomTypeAvailabilityRange,
} from './room_types_types.js';

/**
 * Service for calculating room type availability
 * Handles availability calculations based on quantity and reservations
 */
export class RoomTypeAvailabilityService {
  /**
   * Get available units for a room type on a specific date
   */
  async getAvailableUnits(roomTypeId: string, date: Date): Promise<number> {
    // Get room type
    const roomType = await db('room_types')
      .where({ id: roomTypeId })
      .whereNull('deleted_at')
      .first();

    if (!roomType) {
      throw new Error(`Room type ${roomTypeId} not found`);
    }

    const totalUnits = roomType.qty;
    const dateStr = date.toISOString().split('T')[0];

    // Count reserved units for this date
    const reservedUnits = await this.getReservedUnits(roomTypeId, date);

    // Count maintenance/out-of-service units
    const maintenanceUnits = await this.getMaintenanceUnits(roomTypeId, date);

    // Calculate available units
    const availableUnits = totalUnits - reservedUnits - maintenanceUnits;

    return Math.max(0, availableUnits);
  }

  /**
   * Get availability for a date range
   */
  async getAvailabilityForRange(
    roomTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, number>> {
    const availability = new Map<string, number>();

    // Get room type
    const roomType = await db('room_types')
      .where({ id: roomTypeId })
      .whereNull('deleted_at')
      .first();

    if (!roomType) {
      throw new Error(`Room type ${roomTypeId} not found`);
    }

    const totalUnits = roomType.qty;

    // Get all reservations for this room type in the date range
    const reservations = await db('reservations')
      .where({ room_type_id: roomTypeId })
      .whereNotIn('status', ['Cancelled', 'Checked-out'])
      .whereNull('deleted_at')
      .where(function () {
        this.where('check_in', '<', endDate.toISOString().split('T')[0])
          .where('check_out', '>', startDate.toISOString().split('T')[0]);
      })
      .select('check_in', 'check_out', 'units_requested', 'status');

    // Get maintenance periods
    const maintenance = await this.getMaintenanceForRange(roomTypeId, startDate, endDate);

    // Calculate availability for each day
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      let reservedUnits = 0;

      // Count reserved units for this date
      for (const reservation of reservations) {
        const checkIn = new Date(reservation.check_in);
        const checkOut = new Date(reservation.check_out);
        const unitsRequested = reservation.units_requested || 1;

        if (currentDate >= checkIn && currentDate < checkOut) {
          reservedUnits += unitsRequested;
        }
      }

      // Get maintenance units for this date
      const maintenanceUnits = maintenance.get(dateStr) || 0;

      // Calculate available units
      const availableUnits = totalUnits - reservedUnits - maintenanceUnits;
      availability.set(dateStr, Math.max(0, availableUnits));

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availability;
  }

  /**
   * Check if room type has availability for booking
   */
  async hasAvailability(
    roomTypeId: string,
    checkIn: Date,
    checkOut: Date,
    unitsRequested: number = 1
  ): Promise<boolean> {
    // Get minimum available units across the date range
    const availability = await this.getAvailabilityForRange(roomTypeId, checkIn, checkOut);

    // Check if all days have enough units
    for (const [date, availableUnits] of availability) {
      if (availableUnits < unitsRequested) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get all available room types for a date range
   */
  async getAvailableRoomTypes(
    checkIn: Date,
    checkOut: Date,
    filters?: {
      minPrice?: number;
      maxPrice?: number;
      roomType?: string;
      maxPeople?: number;
      unitsRequested?: number;
    }
  ): Promise<RoomTypeAvailability[]> {
    const unitsRequested = filters?.unitsRequested || 1;

    // Build query for room types
    let query = db('room_types')
      .select('*')
      .whereNull('deleted_at')
      .where('include_reports', true);

    // Apply filters
    if (filters?.roomType) {
      query = query.where('room_type', filters.roomType);
    }

    if (filters?.minPrice) {
      query = query.where('price_per_night', '>=', filters.minPrice);
    }

    if (filters?.maxPrice) {
      query = query.where('price_per_night', '<=', filters.maxPrice);
    }

    if (filters?.maxPeople) {
      query = query.where(function () {
        this.where('max_people', '>=', filters!.maxPeople!)
          .orWhereNull('max_people');
      });
    }

    const roomTypes = await query;

    // Check availability for each room type
    const availableRoomTypes: RoomTypeAvailability[] = [];

    for (const roomType of roomTypes) {
      const availability = await this.getAvailabilityForRange(
        roomType.id,
        checkIn,
        checkOut
      );

      // Find minimum available units across the range
      let minAvailable = roomType.qty;
      for (const [date, availableUnits] of availability) {
        minAvailable = Math.min(minAvailable, availableUnits);
      }

      // Only include if enough units available
      if (minAvailable >= unitsRequested) {
        // Get reserved units for check-in date
        const reservedUnits = await this.getReservedUnits(
          roomType.id,
          checkIn
        );

        availableRoomTypes.push({
          room_type_id: roomType.id,
          room_type_name: roomType.name,
          room_type: roomType.room_type,
          available_units: minAvailable,
          total_units: roomType.qty,
          reserved_units: reservedUnits,
          price_per_night: parseFloat(roomType.price_per_night),
          date: checkIn.toISOString().split('T')[0],
        });
      }
    }

    return availableRoomTypes;
  }

  /**
   * Get reserved units for a room type on a specific date
   */
  private async getReservedUnits(roomTypeId: string, date: Date): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];

    const reservations = await db('reservations')
      .where({ room_type_id: roomTypeId })
      .whereNotIn('status', ['Cancelled', 'Checked-out'])
      .whereNull('deleted_at')
      .where('check_in', '<=', dateStr)
      .where('check_out', '>', dateStr)
      .sum('units_requested as total');

    const total = reservations[0]?.total || 0;
    return parseInt(total.toString()) || 0;
  }

  /**
   * Get maintenance units for a room type on a specific date
   */
  private async getMaintenanceUnits(roomTypeId: string, date: Date): Promise<number> {
    // For now, we'll check maintenance_requests table
    // If maintenance is linked to room_type_id, count affected units
    // Otherwise, return 0
    const dateStr = date.toISOString().split('T')[0];

    const maintenance = await db('maintenance_requests')
      .where({ room_type_id: roomTypeId })
      .where('status', '!=', 'Completed')
      .where('start_date', '<=', dateStr)
      .where('end_date', '>=', dateStr)
      .sum('affected_units as total')
      .first();

    // If affected_units column doesn't exist, count as 1 unit per maintenance request
    if (!maintenance?.total) {
      const count = await db('maintenance_requests')
        .where({ room_type_id: roomTypeId })
        .where('status', '!=', 'Completed')
        .where('start_date', '<=', dateStr)
        .where('end_date', '>=', dateStr)
        .count('* as count')
        .first();

      return parseInt(count?.count?.toString() || '0') || 0;
    }

    return parseInt(maintenance.total.toString()) || 0;
  }

  /**
   * Get maintenance units for a date range
   */
  private async getMaintenanceForRange(
    roomTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, number>> {
    const maintenance = new Map<string, number>();

    // Get all maintenance periods
    const maintenanceRequests = await db('maintenance_requests')
      .where({ room_type_id: roomTypeId })
      .where('status', '!=', 'Completed')
      .where(function () {
        this.where('start_date', '<=', endDate.toISOString().split('T')[0])
          .where('end_date', '>=', startDate.toISOString().split('T')[0]);
      })
      .select('start_date', 'end_date', 'affected_units');

    // Calculate maintenance units for each day
    const currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      let maintenanceUnits = 0;

      for (const maint of maintenanceRequests) {
        const startDate = new Date(maint.start_date);
        const endDate = new Date(maint.end_date);
        const affectedUnits = maint.affected_units || 1;

        if (currentDate >= startDate && currentDate <= endDate) {
          maintenanceUnits += affectedUnits;
        }
      }

      maintenance.set(dateStr, maintenanceUnits);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return maintenance;
  }
}

