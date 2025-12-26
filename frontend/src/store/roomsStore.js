import { create } from 'zustand';
import { api } from '../utils/api.js';

const useRoomsStore = create((set, get) => ({
  rooms: [],
  housekeeping: [],
  isLoading: false,
  error: null,

  // Fetch all rooms
  fetchRooms: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const rooms = await api.rooms.getAll(filters);
      // Transform backend format to frontend format
      const transformedRooms = rooms.map((room) => ({
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        status: room.status,
        pricePerNight: parseFloat(room.price_per_night),
        floor: room.floor,
        features: Array.isArray(room.features) ? room.features : [],
        description: room.description,
      }));
      set({ rooms: transformedRooms, isLoading: false });
      return transformedRooms;
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Failed to fetch rooms' });
      throw error;
    }
  },

  // Add room
  addRoom: async (roomData) => {
    set({ isLoading: true, error: null });
    try {
      // Transform frontend format to backend format
      const backendData = {
        room_number: roomData.roomNumber,
        type: roomData.type,
        status: roomData.status || 'Available',
        price_per_night: roomData.pricePerNight,
        floor: roomData.floor,
        features: roomData.features || [],
        description: roomData.description,
      };

      const room = await api.rooms.create(backendData);
      
      // Transform backend response to frontend format
      const transformedRoom = {
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        status: room.status,
        pricePerNight: parseFloat(room.price_per_night),
        floor: room.floor,
        features: Array.isArray(room.features) ? room.features : [],
        description: room.description,
      };

      set((state) => ({
        rooms: [...state.rooms, transformedRoom],
        isLoading: false,
      }));

      // Fetch housekeeping for the new room
      await get().fetchHousekeeping();

      return transformedRoom;
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Failed to add room' });
      throw error;
    }
  },

  // Update room
  updateRoom: async (roomId, updates) => {
    set({ isLoading: true, error: null });
    try {
      // Transform frontend format to backend format
      const backendUpdates = {};
      if (updates.roomNumber !== undefined) backendUpdates.room_number = updates.roomNumber;
      if (updates.type !== undefined) backendUpdates.type = updates.type;
      if (updates.status !== undefined) backendUpdates.status = updates.status;
      if (updates.pricePerNight !== undefined) backendUpdates.price_per_night = updates.pricePerNight;
      if (updates.floor !== undefined) backendUpdates.floor = updates.floor;
      if (updates.features !== undefined) backendUpdates.features = updates.features;
      if (updates.description !== undefined) backendUpdates.description = updates.description;

      const room = await api.rooms.update(roomId, backendUpdates);
      
      // Transform backend response to frontend format
      const transformedRoom = {
        id: room.id,
        roomNumber: room.room_number,
        type: room.type,
        status: room.status,
        pricePerNight: parseFloat(room.price_per_night),
        floor: room.floor,
        features: Array.isArray(room.features) ? room.features : [],
        description: room.description,
      };

      set((state) => ({
        rooms: state.rooms.map((r) => (r.id === roomId ? transformedRoom : r)),
        isLoading: false,
      }));

      // Refresh housekeeping if status changed
      if (updates.status !== undefined) {
        await get().fetchHousekeeping();
      }

      return transformedRoom;
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Failed to update room' });
      throw error;
    }
  },

  // Fetch all housekeeping
  fetchHousekeeping: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const housekeeping = await api.rooms.getAllHousekeeping(filters);
      // Transform backend format to frontend format
      const transformedHousekeeping = housekeeping.map((hk) => ({
        id: hk.id,
        roomId: hk.room_id,
        status: hk.status,
        assignedStaff: hk.assigned_staff_name || hk.assigned_staff_id || '',
        lastCleaned: hk.last_cleaned,
        notes: hk.notes,
      }));
      set({ housekeeping: transformedHousekeeping, isLoading: false });
      return transformedHousekeeping;
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Failed to fetch housekeeping' });
      throw error;
    }
  },

  // Update housekeeping status
  updateHousekeepingStatus: async (roomId, status, assignedStaff = '') => {
    set({ isLoading: true, error: null });
    try {
      // Check if assignedStaff is a UUID (user ID) or a name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedStaff);
      
      const updateData = {
        status,
        ...(isUUID 
          ? { assigned_staff_id: assignedStaff || null }
          : { assigned_staff_name: assignedStaff || null }
        ),
      };

      const housekeeping = await api.rooms.updateHousekeeping(roomId, updateData);
      
      // Transform backend response to frontend format
      const transformedHousekeeping = {
        id: housekeeping.id,
        roomId: housekeeping.room_id,
        status: housekeeping.status,
        assignedStaff: housekeeping.assigned_staff_name || housekeeping.assigned_staff_id || '',
        lastCleaned: housekeeping.last_cleaned,
        notes: housekeeping.notes,
      };

      set((state) => ({
        housekeeping: state.housekeeping.map((hk) =>
          hk.roomId === roomId ? transformedHousekeeping : hk
        ),
        isLoading: false,
      }));

      return transformedHousekeeping;
    } catch (error) {
      set({ isLoading: false, error: error.message || 'Failed to update housekeeping' });
      throw error;
    }
  },

  // Initialize - fetch rooms and housekeeping on mount
  initialize: async () => {
    await Promise.all([get().fetchRooms(), get().fetchHousekeeping()]);
  },
}));

export default useRoomsStore;

