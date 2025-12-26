import { create } from 'zustand';
import { api } from '../utils/api';

const useReservationsStore = create((set, get) => ({
  reservations: [],
  loading: false,
  error: null,

  // Fetch all reservations
  fetchReservations: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await api.reservations.getAll(filters);
      
      // Transform API response to match frontend format
      const transformed = data.map((res) => ({
        id: res.id,
        guestId: res.primary_guest_id,
        guestName: res.primary_guest_name,
        guestEmail: res.primary_guest_email,
        guestPhone: res.primary_guest_phone,
        guest2Id: res.secondary_guest_id,
        guest2Name: res.secondary_guest_name,
        guest2Email: res.secondary_guest_email,
        guest2Phone: res.secondary_guest_phone,
        roomNumber: res.room_number,
        roomId: res.room_id,
        checkIn: res.check_in,
        checkOut: res.check_out,
        status: res.status,
        totalAmount: res.total_amount,
        source: res.source,
        specialRequests: res.special_requests,
        createdAt: res.created_at,
        updatedAt: res.updated_at,
      }));

      set({ reservations: transformed, loading: false });
      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch reservations', loading: false });
      throw error;
    }
  },

  // Fetch single reservation
  fetchReservation: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.reservations.getById(id);
      
      // Transform API response
      const transformed = {
        id: data.id,
        guestId: data.primary_guest_id,
        guestName: data.primary_guest_name,
        guestEmail: data.primary_guest_email,
        guestPhone: data.primary_guest_phone,
        guest2Id: data.secondary_guest_id,
        guest2Name: data.secondary_guest_name,
        guest2Email: data.secondary_guest_email,
        guest2Phone: data.secondary_guest_phone,
        roomNumber: data.room_number,
        roomId: data.room_id,
        checkIn: data.check_in,
        checkOut: data.check_out,
        status: data.status,
        totalAmount: data.total_amount,
        source: data.source,
        specialRequests: data.special_requests,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Update in list if exists
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? transformed : r
        ),
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch reservation', loading: false });
      throw error;
    }
  },

  // Create reservation
  createReservation: async (reservationData) => {
    set({ loading: true, error: null });
    try {
      const payload = {
        room_id: reservationData.roomId || reservationData.room_id,
        primary_guest_id: reservationData.guestId || reservationData.primary_guest_id,
        secondary_guest_id: reservationData.guest2Id || reservationData.secondary_guest_id,
        check_in: reservationData.checkIn || reservationData.check_in,
        check_out: reservationData.checkOut || reservationData.check_out,
        status: reservationData.status || 'Confirmed',
        source: reservationData.source || 'Direct',
        special_requests: reservationData.specialRequests || reservationData.special_requests,
        force: reservationData.force || false,
      };

      const data = await api.reservations.create(payload);

      // Transform API response
      const transformed = {
        id: data.id,
        guestId: data.primary_guest_id,
        guestName: data.primary_guest_name,
        guestEmail: data.primary_guest_email,
        guestPhone: data.primary_guest_phone,
        guest2Id: data.secondary_guest_id,
        guest2Name: data.secondary_guest_name,
        guest2Email: data.secondary_guest_email,
        guest2Phone: data.secondary_guest_phone,
        roomNumber: data.room_number,
        roomId: data.room_id,
        checkIn: data.check_in,
        checkOut: data.check_out,
        status: data.status,
        totalAmount: data.total_amount,
        source: data.source,
        specialRequests: data.special_requests,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        reservations: [transformed, ...state.reservations],
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to create reservation', loading: false });
      throw error;
    }
  },

  // Update reservation
  updateReservation: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const payload = {};
      if (updates.roomId || updates.room_id) {
        payload.room_id = updates.roomId || updates.room_id;
      }
      if (updates.checkIn || updates.check_in) {
        payload.check_in = updates.checkIn || updates.check_in;
      }
      if (updates.checkOut || updates.check_out) {
        payload.check_out = updates.checkOut || updates.check_out;
      }
      if (updates.status !== undefined) {
        payload.status = updates.status;
      }
      if (updates.specialRequests !== undefined || updates.special_requests !== undefined) {
        payload.special_requests = updates.specialRequests || updates.special_requests;
      }

      const data = await api.reservations.update(id, payload);

      // Transform API response
      const transformed = {
        id: data.id,
        guestId: data.primary_guest_id,
        guestName: data.primary_guest_name,
        guestEmail: data.primary_guest_email,
        guestPhone: data.primary_guest_phone,
        guest2Id: data.secondary_guest_id,
        guest2Name: data.secondary_guest_name,
        guest2Email: data.secondary_guest_email,
        guest2Phone: data.secondary_guest_phone,
        roomNumber: data.room_number,
        roomId: data.room_id,
        checkIn: data.check_in,
        checkOut: data.check_out,
        status: data.status,
        totalAmount: data.total_amount,
        source: data.source,
        specialRequests: data.special_requests,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? transformed : r
        ),
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to update reservation', loading: false });
      throw error;
    }
  },

  // Delete reservation
  deleteReservation: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.reservations.delete(id);

      set((state) => ({
        reservations: state.reservations.filter((r) => r.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to delete reservation', loading: false });
      throw error;
    }
  },

  // Check availability
  checkAvailability: async (checkIn, checkOut, roomId = null) => {
    try {
      const params = {
        check_in: checkIn,
        check_out: checkOut,
      };
      if (roomId) params.room_id = roomId;

      const data = await api.reservations.checkAvailability(params);
      return data;
    } catch (error) {
      throw error;
    }
  },
}));

export default useReservationsStore;

