import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setTokens, clearTokens } from '../utils/api.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.login(email, password);
          setTokens(response.token, response.refreshToken);
          set({
            user: response.user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || 'Login failed',
          });
          return { success: false, error: error.message };
        }
      },

      // Register
      register: async (email, password, firstName, lastName, role) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.register(email, password, firstName, lastName, role);
          setTokens(response.token, response.refreshToken);
          set({
            user: response.user,
            token: response.token,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return { success: true };
        } catch (error) {
          set({
            isLoading: false,
            error: error.message || 'Registration failed',
          });
          return { success: false, error: error.message };
        }
      },

      // Logout
      logout: () => {
        clearTokens();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Check authentication status
      checkAuth: async () => {
        const token = get().token;
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }

        try {
          const response = await api.getMe();
          set({
            user: response.user,
            isAuthenticated: true,
          });
          return true;
        } catch (error) {
          // Token is invalid, clear auth state
          get().logout();
          return false;
        }
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;

