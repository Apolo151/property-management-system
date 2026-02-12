import { create } from 'zustand';
import api from '../utils/api';

const useCheckInsStore = create((set, get) => ({
  checkIns: [],
  activeCheckIns: [],
  currentCheckIn: null,
  loading: false,
  error: null,
  filters: {
    status: '',
    roomId: '',
    guestName: '',
    dateFrom: '',
    dateTo: '',
  },

  // Fetch all check-ins with filters
  fetchCheckIns: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.checkIns.getAll(filters);
      // Backend returns paginated response: { check_ins: [...], total, page, ... }
      const checkInsData = response.check_ins || (Array.isArray(response) ? response : []);
      
      // Transform backend format to frontend format
      const checkIns = checkInsData.map((ci) => ({
        id: ci.id,
        hotel_id: ci.hotel_id,
        reservation_id: ci.reservation_id,
        actual_room_id: ci.actual_room_id,
        room_number: ci.actual_room_number,
        check_in_time: ci.check_in_time,
        expected_checkout_time: ci.expected_checkout_time,
        actual_checkout_time: ci.actual_checkout_time,
        checked_in_by: ci.checked_in_by,
        checked_in_by_name: ci.checked_in_by_name,
        notes: ci.notes,
        status: ci.status,
        created_at: ci.created_at,
        updated_at: ci.updated_at,
        // Guest info from nested reservation
        guest_name: ci.reservation?.primary_guest_name || '',
        guest_email: ci.reservation?.primary_guest_email || '',
        guest_phone: ci.reservation?.primary_guest_phone || '',
        room_type_name: ci.reservation?.room_type_name || '',
      }));
      
      const activeCheckIns = checkIns.filter((c) => c.status === 'checked_in');
      set({ checkIns, activeCheckIns, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Fetch single check-in by ID
  fetchCheckIn: async (id) => {
    set({ loading: true, error: null });
    try {
      const checkIn = await api.checkIns.getById(id);
      set({ currentCheckIn: checkIn, loading: false });
      return checkIn;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Check in a guest from a reservation
  checkInGuest: async (reservationId, checkInData) => {
    set({ loading: true, error: null });
    try {
      const checkIn = await api.checkIns.checkInFromReservation(
        reservationId,
        checkInData
      );
      
      // Transform the response
      const transformed = {
        id: checkIn.id,
        hotel_id: checkIn.hotel_id,
        reservation_id: checkIn.reservation_id,
        actual_room_id: checkIn.actual_room_id,
        room_number: checkIn.actual_room_number,
        check_in_time: checkIn.check_in_time,
        expected_checkout_time: checkIn.expected_checkout_time,
        actual_checkout_time: checkIn.actual_checkout_time,
        checked_in_by: checkIn.checked_in_by,
        checked_in_by_name: checkIn.checked_in_by_name,
        notes: checkIn.notes,
        status: checkIn.status,
        created_at: checkIn.created_at,
        updated_at: checkIn.updated_at,
        guest_name: checkIn.reservation?.primary_guest_name || '',
        guest_email: checkIn.reservation?.primary_guest_email || '',
        guest_phone: checkIn.reservation?.primary_guest_phone || '',
        room_type_name: checkIn.reservation?.room_type_name || '',
      };
      
      // Refresh the list
      await get().fetchCheckIns(get().filters);
      set({ loading: false });
      return transformed;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Create a check-in directly (advanced use)
  createCheckIn: async (checkInData) => {
    set({ loading: true, error: null });
    try {
      const checkIn = await api.checkIns.create(checkInData);
      // Refresh the list
      await get().fetchCheckIns(get().filters);
      set({ loading: false });
      return checkIn;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Check out a guest
  checkOutGuest: async (checkInId, checkoutData = {}) => {
    set({ loading: true, error: null });
    try {
      const checkIn = await api.checkIns.checkout(checkInId, checkoutData);
      
      // Transform the response
      const transformed = {
        id: checkIn.id,
        hotel_id: checkIn.hotel_id,
        reservation_id: checkIn.reservation_id,
        actual_room_id: checkIn.actual_room_id,
        room_number: checkIn.actual_room_number,
        check_in_time: checkIn.check_in_time,
        expected_checkout_time: checkIn.expected_checkout_time,
        actual_checkout_time: checkIn.actual_checkout_time,
        checked_in_by: checkIn.checked_in_by,
        checked_in_by_name: checkIn.checked_in_by_name,
        notes: checkIn.notes,
        status: checkIn.status,
        created_at: checkIn.created_at,
        updated_at: checkIn.updated_at,
        guest_name: checkIn.reservation?.primary_guest_name || '',
        guest_email: checkIn.reservation?.primary_guest_email || '',
        guest_phone: checkIn.reservation?.primary_guest_phone || '',
        room_type_name: checkIn.reservation?.room_type_name || '',
      };
      
      // Update the check-in in the list
      set((state) => ({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId ? transformed : c
        ),
        activeCheckIns: state.activeCheckIns.filter((c) => c.id !== checkInId),
        loading: false,
      }));
      return transformed;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Change room for a check-in
  changeRoom: async (checkInId, roomChangeData) => {
    set({ loading: true, error: null });
    try {
      const checkIn = await api.checkIns.changeRoom(checkInId, roomChangeData);
      
      // Transform the response
      const transformed = {
        id: checkIn.id,
        hotel_id: checkIn.hotel_id,
        reservation_id: checkIn.reservation_id,
        actual_room_id: checkIn.actual_room_id,
        room_number: checkIn.actual_room_number,
        check_in_time: checkIn.check_in_time,
        expected_checkout_time: checkIn.expected_checkout_time,
        actual_checkout_time: checkIn.actual_checkout_time,
        checked_in_by: checkIn.checked_in_by,
        checked_in_by_name: checkIn.checked_in_by_name,
        notes: checkIn.notes,
        status: checkIn.status,
        created_at: checkIn.created_at,
        updated_at: checkIn.updated_at,
        guest_name: checkIn.reservation?.primary_guest_name || '',
        guest_email: checkIn.reservation?.primary_guest_email || '',
        guest_phone: checkIn.reservation?.primary_guest_phone || '',
        room_type_name: checkIn.reservation?.room_type_name || '',
      };
      
      // Update the check-in in the list
      set((state) => ({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId ? transformed : c
        ),
        activeCheckIns: state.activeCheckIns.map((c) =>
          c.id === checkInId ? transformed : c
        ),
        loading: false,
      }));
      return transformed;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Get eligible rooms for a reservation
  getEligibleRooms: async (reservationId) => {
    try {
      return await api.checkIns.getEligibleRooms(reservationId);
    } catch (error) {
      throw error;
    }
  },

  // Set filters
  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
  },

  // Clear filters
  clearFilters: () => {
    set({
      filters: {
        status: '',
        roomId: '',
        guestName: '',
        dateFrom: '',
        dateTo: '',
      },
    });
  },

  // Selectors
  getActiveCheckIns: () => get().activeCheckIns,

  getCheckInByRoom: (roomId) =>
    get().checkIns.find(
      (c) => c.actual_room_id === roomId && c.status === 'checked_in'
    ),

  getCheckInsByStatus: (status) =>
    get().checkIns.filter((c) => c.status === status),

  // Clear current check-in
  clearCurrentCheckIn: () => set({ currentCheckIn: null }),

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useCheckInsStore;

