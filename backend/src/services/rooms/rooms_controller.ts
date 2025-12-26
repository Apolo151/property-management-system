import type { Request, Response, NextFunction } from 'express';
import db from '../../config/database.js';
import type {
  CreateRoomRequest,
  UpdateRoomRequest,
  UpdateHousekeepingRequest,
  RoomResponse,
  HousekeepingResponse,
} from './rooms_types.js';

// Get all rooms
export async function getRoomsHandler(
  req: Request,
  res: Response<RoomResponse[]>,
  next: NextFunction,
) {
  try {
    const { status, type, search } = req.query;

    let query = db('rooms').select('*').orderBy('room_number', 'asc');

    if (status) {
      query = query.where('status', status as string);
    }

    if (type) {
      query = query.where('type', type as string);
    }

    if (search) {
      query = query.where('room_number', 'ilike', `%${search}%`);
    }

    const rooms = await query;

    const roomsWithFeatures = rooms.map((room) => ({
      ...room,
      features: Array.isArray(room.features) ? room.features : [],
    }));

    res.json(roomsWithFeatures as any);
  } catch (error) {
    next(error);
  }
}

// Get single room
export async function getRoomHandler(
  req: Request<{ id: string }>,
  res: Response<RoomResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const room = await db('rooms').where({ id }).first();

    if (!room) {
      res.status(404).json({
        error: 'Room not found',
      } as any);
      return;
    }

    const roomWithFeatures = {
      ...room,
      features: Array.isArray(room.features) ? room.features : [],
    };

    res.json(roomWithFeatures as any);
  } catch (error) {
    next(error);
  }
}

// Create room
export async function createRoomHandler(
  req: Request<{}, RoomResponse, CreateRoomRequest>,
  res: Response<RoomResponse>,
  next: NextFunction,
) {
  try {
    const { room_number, type, status = 'Available', price_per_night, floor, features = [], description } = req.body;

    // Validation
    if (!room_number || !type || !price_per_night || !floor) {
      res.status(400).json({
        error: 'room_number, type, price_per_night, and floor are required',
      } as any);
      return;
    }

    // Check if room number already exists
    const existing = await db('rooms').where({ room_number }).first();
    if (existing) {
      res.status(409).json({
        error: 'Room with this number already exists',
      } as any);
      return;
    }

    // Validate type
    if (!['Single', 'Double', 'Suite'].includes(type)) {
      res.status(400).json({
        error: 'Invalid room type',
      } as any);
      return;
    }

    // Validate status
    if (!['Available', 'Occupied', 'Cleaning', 'Out of Service'].includes(status)) {
      res.status(400).json({
        error: 'Invalid room status',
      } as any);
      return;
    }

    // Create room
    const [room] = await db('rooms')
      .insert({
        room_number,
        type,
        status,
        price_per_night,
        floor,
        features: JSON.stringify(features),
        description,
      })
      .returning('*');

    // Create housekeeping record for the room
    await db('housekeeping').insert({
      room_id: room.id,
      status: status === 'Cleaning' ? 'In Progress' : status === 'Occupied' ? 'Dirty' : 'Clean',
    });

    const roomWithFeatures = {
      ...room,
      features: Array.isArray(room.features) ? room.features : [],
    };

    res.status(201).json(roomWithFeatures as any);
  } catch (error) {
    next(error);
  }
}

// Update room
export async function updateRoomHandler(
  req: Request<{ id: string }, RoomResponse, UpdateRoomRequest>,
  res: Response<RoomResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if room exists
    const existing = await db('rooms').where({ id }).first();
    if (!existing) {
      res.status(404).json({
        error: 'Room not found',
      } as any);
      return;
    }

    // If room_number is being updated, check for duplicates
    if (updates.room_number && updates.room_number !== existing.room_number) {
      const duplicate = await db('rooms').where({ room_number: updates.room_number }).first();
      if (duplicate) {
        res.status(409).json({
          error: 'Room with this number already exists',
        } as any);
        return;
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date(),
    };

    if (updates.room_number !== undefined) updateData.room_number = updates.room_number;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.price_per_night !== undefined) updateData.price_per_night = updates.price_per_night;
    if (updates.floor !== undefined) updateData.floor = updates.floor;
    if (updates.features !== undefined) updateData.features = JSON.stringify(updates.features);
    if (updates.description !== undefined) updateData.description = updates.description;

    // Update room
    const [room] = await db('rooms')
      .where({ id })
      .update(updateData)
      .returning('*');

    // Update housekeeping status if room status changed
    if (updates.status) {
      let housekeepingStatus = 'Clean';
      if (updates.status === 'Cleaning') housekeepingStatus = 'In Progress';
      else if (updates.status === 'Occupied') housekeepingStatus = 'Dirty';

      await db('housekeeping')
        .where({ room_id: id })
        .update({
          status: housekeepingStatus,
          updated_at: new Date(),
        });
    }

    const roomWithFeatures = {
      ...room,
      features: Array.isArray(room.features) ? room.features : [],
    };

    res.json(roomWithFeatures as any);
  } catch (error) {
    next(error);
  }
}

// Delete room
export async function deleteRoomHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const room = await db('rooms').where({ id }).first();
    if (!room) {
      res.status(404).json({
        error: 'Room not found',
      });
      return;
    }

    // Check if room has active reservations
    const activeReservations = await db('reservations')
      .where({ room_id: id })
      .whereIn('status', ['Confirmed', 'Checked-in'])
      .whereNull('deleted_at')
      .first();

    if (activeReservations) {
      res.status(400).json({
        error: 'Cannot delete room with active reservations',
      });
      return;
    }

    // Delete room (CASCADE will delete housekeeping)
    await db('rooms').where({ id }).delete();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Get housekeeping for a room
export async function getRoomHousekeepingHandler(
  req: Request<{ id: string }>,
  res: Response<HousekeepingResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const housekeeping = await db('housekeeping').where({ room_id: id }).first();

    if (!housekeeping) {
      // Create housekeeping record if it doesn't exist
      const room = await db('rooms').where({ id }).first();
      if (!room) {
        res.status(404).json({
          error: 'Room not found',
        } as any);
        return;
      }

      const [newHousekeeping] = await db('housekeeping')
        .insert({
          room_id: id,
          status: 'Clean',
        })
        .returning('*');

      res.json(newHousekeeping as any);
      return;
    }

    res.json(housekeeping as any);
  } catch (error) {
    next(error);
  }
}

// Update housekeeping for a room
export async function updateRoomHousekeepingHandler(
  req: Request<{ id: string }, HousekeepingResponse, UpdateHousekeepingRequest>,
  res: Response<HousekeepingResponse>,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const { status, assigned_staff_id, assigned_staff_name, notes } = req.body;

    if (!status) {
      res.status(400).json({
        error: 'status is required',
      } as any);
      return;
    }

    // Validate status
    if (!['Clean', 'Dirty', 'In Progress'].includes(status)) {
      res.status(400).json({
        error: 'Invalid housekeeping status',
      } as any);
      return;
    }

    // Check if room exists
    const room = await db('rooms').where({ id }).first();
    if (!room) {
      res.status(404).json({
        error: 'Room not found',
      } as any);
      return;
    }

    // Check if housekeeping record exists
    let housekeeping = await db('housekeeping').where({ room_id: id }).first();

    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'Clean') {
      updateData.last_cleaned = new Date();
    }

    if (assigned_staff_id !== undefined) {
      // If empty string, set to null. Otherwise try to use as UUID or leave as null
      updateData.assigned_staff_id = assigned_staff_id && assigned_staff_id.trim() !== '' 
        ? assigned_staff_id 
        : null;
    }

    if (assigned_staff_name !== undefined) {
      updateData.assigned_staff_name = assigned_staff_name || null;
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    if (housekeeping) {
      // Update existing
      const [updated] = await db('housekeeping')
        .where({ room_id: id })
        .update(updateData)
        .returning('*');

      res.json(updated as any);
    } else {
      // Create new
      const [created] = await db('housekeeping')
        .insert({
          room_id: id,
          ...updateData,
        })
        .returning('*');

      res.status(201).json(created as any);
    }
  } catch (error) {
    next(error);
  }
}

// Get all housekeeping records
export async function getAllHousekeepingHandler(
  req: Request,
  res: Response<HousekeepingResponse[]>,
  next: NextFunction,
) {
  try {
    const { status, search } = req.query;

    let query = db('housekeeping')
      .select('housekeeping.*')
      .orderBy('housekeeping.created_at', 'desc');

    if (status) {
      query = query.where('housekeeping.status', status as string);
    }

    if (search) {
      query = query
        .join('rooms', 'housekeeping.room_id', 'rooms.id')
        .where('rooms.room_number', 'ilike', `%${search}%`)
        .select('housekeeping.*'); // Ensure we only select housekeeping columns
    }

    const housekeeping = await query;

    res.json(housekeeping as any);
  } catch (error) {
    next(error);
  }
}

