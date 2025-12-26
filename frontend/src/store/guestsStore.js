import { create } from 'zustand';
import { api } from '../utils/api';

const useGuestsStore = create((set, get) => ({
  guests: [],
  loading: false,
  error: null,

  // Fetch all guests
  fetchGuests: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const data = await api.guests.getAll(filters);
      
      // Transform API response to match frontend format
      const transformed = data.map((guest) => ({
        id: guest.id,
        name: guest.name,
        email: guest.email || '',
        phone: guest.phone || '',
        pastStays: guest.past_stays || 0,
        notes: guest.notes || '',
        createdAt: guest.created_at,
        updatedAt: guest.updated_at,
      }));

      set({ guests: transformed, loading: false });
      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch guests', loading: false });
      throw error;
    }
  },

  // Fetch single guest
  fetchGuest: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.guests.getById(id);
      
      // Transform API response
      const transformed = {
        id: data.id,
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        pastStays: data.past_stays || 0,
        notes: data.notes || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Update in list if exists
      set((state) => ({
        guests: state.guests.map((g) =>
          g.id === id ? transformed : g
        ),
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to fetch guest', loading: false });
      throw error;
    }
  },

  // Create guest
  createGuest: async (guestData) => {
    set({ loading: true, error: null });
    try {
      const payload = {
        name: guestData.name,
        email: guestData.email || undefined,
        phone: guestData.phone || undefined,
        past_stays: guestData.pastStays || guestData.past_stays || 0,
        notes: guestData.notes || undefined,
      };

      const data = await api.guests.create(payload);

      // Transform API response
      const transformed = {
        id: data.id,
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        pastStays: data.past_stays || 0,
        notes: data.notes || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        guests: [transformed, ...state.guests],
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to create guest', loading: false });
      throw error;
    }
  },

  // Update guest
  updateGuest: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const payload = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.email !== undefined) payload.email = updates.email || null;
      if (updates.phone !== undefined) payload.phone = updates.phone || null;
      if (updates.pastStays !== undefined || updates.past_stays !== undefined) {
        payload.past_stays = updates.pastStays || updates.past_stays || 0;
      }
      if (updates.notes !== undefined) payload.notes = updates.notes || null;

      const data = await api.guests.update(id, payload);

      // Transform API response
      const transformed = {
        id: data.id,
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        pastStays: data.past_stays || 0,
        notes: data.notes || '',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      set((state) => ({
        guests: state.guests.map((g) =>
          g.id === id ? transformed : g
        ),
        loading: false,
      }));

      return transformed;
    } catch (error) {
      set({ error: error.message || 'Failed to update guest', loading: false });
      throw error;
    }
  },

  // Delete guest
  deleteGuest: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.guests.delete(id);

      set((state) => ({
        guests: state.guests.filter((g) => g.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message || 'Failed to delete guest', loading: false });
      throw error;
    }
  },
}));

export default useGuestsStore;

