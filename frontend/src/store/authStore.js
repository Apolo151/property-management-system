import { create } from 'zustand';
import { api } from '../utils/api.js';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  hotels: [],
  activeHotelId: null,

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.login(email, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      // Store hotels and activeHotelId
      const hotels = response.hotels || [];
      const activeHotelId = response.activeHotelId || (hotels.length > 0 ? hotels[0].id : null);
      
      if (activeHotelId) {
        localStorage.setItem('activeHotelId', activeHotelId);
      }
      localStorage.setItem('hotels', JSON.stringify(hotels));
      
      set({
        user: response.user,
        token: response.token,
        refreshToken: response.refreshToken,
        hotels,
        activeHotelId,
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
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  // Register
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.auth.register(userData);
      localStorage.setItem('token', response.token);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));
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
      return { success: false, error: error.message || 'Registration failed' };
    }
  },

  // Logout
  logout: () => {
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
      hotels: [],
      activeHotelId: null,
    });
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('hotels');
    localStorage.removeItem('activeHotelId');
  },

  // Refresh token
  refreshAccessToken: async () => {
    const { refreshToken } = get();
    if (!refreshToken) {
      get().logout();
      return false;
    }

    try {
      const response = await api.auth.refreshToken(refreshToken);
      localStorage.setItem('token', response.token);
      // Update refresh token if a new one is provided (token rotation)
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
        set({
          token: response.token,
          refreshToken: response.refreshToken,
        });
      } else {
        set({
          token: response.token,
        });
      }
      return true;
    } catch (error) {
      get().logout();
      return false;
    }
  },

  // Get current user
  getCurrentUser: async () => {
    try {
      const response = await api.auth.me();
      
      // Update hotels if provided
      const hotels = response.hotels || [];
      if (hotels.length > 0) {
        localStorage.setItem('hotels', JSON.stringify(hotels));
      }
      
      set({
        user: response.user,
        hotels,
        isAuthenticated: true,
      });
      localStorage.setItem('user', JSON.stringify(response.user));
      return response.user;
    } catch (error) {
      get().logout();
      return null;
    }
  },

  // Switch hotel
  switchHotel: (hotelId) => {
    const { hotels } = get();
    
    // Validate hotel exists in user's hotels list
    const hotel = hotels.find(h => h.id === hotelId);
    if (!hotel) {
      console.error('Hotel not found in user\'s hotels list');
      return false;
    }
    
    // Update state and localStorage
    localStorage.setItem('activeHotelId', hotelId);
    set({ activeHotelId: hotelId });
    
    return true;
  },

  // Get active hotel
  getActiveHotel: () => {
    const { hotels, activeHotelId } = get();
    return hotels.find(h => h.id === activeHotelId) || null;
  },

  // Check if token is expired or about to expire (within 2 minutes)
  isTokenExpiringSoon: () => {
    const token = localStorage.getItem('token');
    if (!token) return true;

    try {
      // Decode JWT without verification (just to check expiration)
      const parts = token.split('.');
      if (parts.length !== 3) return true; // Invalid JWT format
      
      const payload = JSON.parse(atob(parts[1]));
      
      // If no expiration claim, assume it's valid but check with server
      if (!payload.exp) return false;
      
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      
      // Return true if token is already expired or expires within 2 minutes
      return exp <= now || (exp - now < twoMinutes);
    } catch (error) {
      // If we can't parse, assume expired to be safe
      return true;
    }
  },

  // Proactive token refresh (call this periodically or before important requests)
  ensureValidToken: async () => {
    const { isAuthenticated, refreshToken } = get();
    
    if (!isAuthenticated || !refreshToken) {
      return false;
    }

    if (get().isTokenExpiringSoon()) {
      return await get().refreshAccessToken();
    }

    return true;
  },

  // Initialize auth from storage
  initialize: () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    const hotelsStr = localStorage.getItem('hotels');
    let activeHotelId = localStorage.getItem('activeHotelId');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const hotels = hotelsStr ? JSON.parse(hotelsStr) : [];
        
        // If no activeHotelId but user has hotels, set the first one
        if (!activeHotelId && hotels.length > 0) {
          activeHotelId = hotels[0].id;
          localStorage.setItem('activeHotelId', activeHotelId);
        }
        
        set({
          user,
          token,
          refreshToken,
          hotels,
          activeHotelId,
          isAuthenticated: true,
        });
        
        // Check if token is expired or expiring soon
        if (get().isTokenExpiringSoon()) {
          // Token is expired or expiring soon, try to refresh
          if (refreshToken) {
            get().refreshAccessToken().catch(() => {
              // Refresh failed, verify with backend
              get().getCurrentUser().catch(() => {
                get().logout();
              });
            });
          } else {
            // No refresh token, verify current token
            get().getCurrentUser().catch(() => {
              get().logout();
            });
          }
        } else {
          // Token is still valid, verify with backend (async, don't block)
          get().getCurrentUser().catch(() => {
            // Token invalid, try refresh
            if (refreshToken) {
              get().refreshAccessToken().catch(() => {
                get().logout();
              });
            } else {
              get().logout();
            }
          });
        }
      } catch (error) {
        get().logout();
      }
    } else {
      // No stored auth, ensure clean state
      get().logout();
    }
  },
}));

export default useAuthStore;

