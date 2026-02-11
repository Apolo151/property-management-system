import type { Request, Response, NextFunction } from 'express';
import db from '../../config/database.js';
import type {
  HotelSettingsResponse,
  UpdateHotelSettingsRequest,
} from './settings_types.js';
import { logAction, logUpdate } from '../audit/audit_utils.js';

/**
 * Clear all data except users and Beds24 token data
 * This is a dangerous operation - use with caution!
 */
export async function clearAllDataHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // This operation should only be done by SUPER_ADMIN
    // The middleware will handle role checking

    console.log('Starting data clearing operation...');

    // Use a transaction to ensure all-or-nothing
    await db.transaction(async (trx) => {
      // Clear in order to respect foreign key constraints
      
      // 1. Clear reservation_guests (junction table)
      await trx('reservation_guests').del();
      console.log('Cleared reservation_guests');

      // 2. Clear reservations
      await trx('reservations').del();
      console.log('Cleared reservations');

      // 3. Clear invoices
      await trx('invoices').del();
      console.log('Cleared invoices');

      // 4. Clear expenses
      await trx('expenses').del();
      console.log('Cleared expenses');

      // 5. Clear maintenance_requests
      await trx('maintenance_requests').del();
      console.log('Cleared maintenance_requests');

      // 6. Clear housekeeping
      await trx('housekeeping').del();
      console.log('Cleared housekeeping');

      // 7. Clear room_types (new Beds24-style)
      await trx('room_types').del();
      console.log('Cleared room_types');

      // 8. Clear rooms (legacy individual rooms)
      await trx('rooms').del();
      console.log('Cleared rooms');

      // 9. Clear guests
      await trx('guests').del();
      console.log('Cleared guests');

      // 10. Clear sync conflicts
      await trx('sync_conflicts').del();
      console.log('Cleared sync_conflicts');

      // 11. Clear webhook events
      await trx('webhook_events').del();
      console.log('Cleared webhook_events');

      // 12. Clear audit logs
      await trx('audit_logs').del();
      console.log('Cleared audit_logs');

      // Note: We keep:
      // - users (authentication data)
      // - beds24_config (Beds24 token data)
      // - hotel_settings (hotel configuration)
    });

    console.log('Data clearing completed successfully');

    res.json({
      success: true,
      message: 'All data cleared successfully (users and Beds24 config preserved)',
    });

    // Audit log: all data cleared
    logAction(req, 'CLEAR_ALL_DATA', 'system', 'all', {
      cleared_tables: [
        'reservation_guests', 'reservations', 'invoices', 'expenses',
        'maintenance_requests', 'housekeeping', 'room_types', 'rooms',
        'guests', 'sync_conflicts', 'webhook_events', 'audit_logs'
      ],
    }).catch((err) => console.error('Audit log failed:', err));
  } catch (error) {
    console.error('Error clearing data:', error);
    next(error);
  }
}

// Get hotel settings
export async function getHotelSettingsHandler(
  req: Request,
  res: Response<HotelSettingsResponse>,
  next: NextFunction,
) {
  try {
    const hotelId = (req as any).hotelId;

    const settings = await db('hotels')
      .where({ id: hotelId })
      .whereNull('deleted_at')
      .first();

    if (!settings) {
      res.status(404).json({
        error: 'Hotel settings not found',
      } as any);
      return;
    }

    // Map hotels table to settings response format
    res.json({
      id: settings.id,
      hotel_name: settings.hotel_name,
      address: settings.hotel_address,
      city: settings.hotel_city,
      country: settings.hotel_country,
      phone: settings.hotel_phone,
      email: settings.hotel_email,
      tax_rate: settings.tax_percentage || 0,
      currency: settings.currency || 'USD',
      timezone: settings.timezone || 'UTC',
      check_in_time: settings.check_in_time || '14:00',
      check_out_time: settings.check_out_time || '11:00',
      beds24_hotel_id: settings.beds24_hotel_id,
      settings: {},
      created_at: settings.created_at,
      updated_at: settings.updated_at,
    } as any);
  } catch (error) {
    next(error);
  }
}

// Update hotel settings
export async function updateHotelSettingsHandler(
  req: Request<{}, HotelSettingsResponse, UpdateHotelSettingsRequest>,
  res: Response<HotelSettingsResponse>,
  next: NextFunction,
) {
  try {
    const hotelId = (req as any).hotelId;
    const body = req.body;

    // Map settings fields to hotels table columns
    const updateData: any = {
      updated_at: new Date(),
    };

    if (body.hotel_name !== undefined) updateData.hotel_name = body.hotel_name;
    if (body.address !== undefined) updateData.hotel_address = body.address;
    if (body.city !== undefined) updateData.hotel_city = body.city;
    if (body.country !== undefined) updateData.hotel_country = body.country;
    if (body.phone !== undefined) updateData.hotel_phone = body.phone;
    if (body.email !== undefined) updateData.hotel_email = body.email;
    if (body.tax_rate !== undefined) updateData.tax_percentage = body.tax_rate;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.check_in_time !== undefined) updateData.check_in_time = body.check_in_time;
    if (body.check_out_time !== undefined) updateData.check_out_time = body.check_out_time;
    if (body.beds24_hotel_id !== undefined) updateData.beds24_hotel_id = body.beds24_hotel_id;

    // Update hotel
    const [updated] = await db('hotels')
      .where({ id: hotelId })
      .whereNull('deleted_at')
      .update(updateData)
      .returning('*');

    if (!updated) {
      res.status(404).json({
        error: 'Hotel not found',
      } as any);
      return;
    }

    // Map response
    res.json({
      id: updated.id,
      hotel_name: updated.hotel_name,
      address: updated.hotel_address,
      city: updated.hotel_city,
      country: updated.hotel_country,
      phone: updated.hotel_phone,
      email: updated.hotel_email,
      tax_rate: updated.tax_percentage || 0,
      currency: updated.currency || 'USD',
      timezone: updated.timezone || 'UTC',
      check_in_time: updated.check_in_time || '14:00',
      check_out_time: updated.check_out_time || '11:00',
      beds24_hotel_id: updated.beds24_hotel_id,
      settings: {},
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    } as any);

    // Audit log: settings updated
    logAction(req, 'UPDATE_SETTINGS', 'hotel', hotelId, {
      updated_fields: Object.keys(req.body),
    }).catch((err) => console.error('Audit log failed:', err));
  } catch (error) {
    next(error);
  }
}

