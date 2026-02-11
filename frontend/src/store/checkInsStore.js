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
      const checkIns = Array.isArray(response) ? response : response.data || [];
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
      // Refresh the list
      await get().fetchCheckIns(get().filters);
      set({ loading: false });
      return checkIn;
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
      // Update the check-in in the list
      set((state) => ({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId ? checkIn : c
        ),
        activeCheckIns: state.activeCheckIns.filter((c) => c.id !== checkInId),
        loading: false,
      }));
      return checkIn;
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
      // Update the check-in in the list
      set((state) => ({
        checkIns: state.checkIns.map((c) =>
          c.id === checkInId ? checkIn : c
        ),
        activeCheckIns: state.activeCheckIns.map((c) =>
          c.id === checkInId ? checkIn : c
        ),
        loading: false,
      }));
      return checkIn;
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

