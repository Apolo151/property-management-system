/**
 * Auth Store Unit Tests
 *
 * Tests Zustand state management for authentication (UC-001–UC-003).
 * Mocks the api module — no real network calls.
 *
 * Run: cd frontend && npx vitest src/store/__tests__/authStore.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module and storeRegistry BEFORE importing the store
vi.mock('../../utils/api.js', () => ({
  api: {
    auth: {
      login: vi.fn(),
      register: vi.fn(),
      refreshToken: vi.fn(),
      me: vi.fn(),
    },
  },
}));

vi.mock('../../store/storeRegistry.js', () => ({
  resetAllDomainStores: vi.fn(),
}));

import { api } from '../../utils/api.js';
import useAuthStore from '../../store/authStore.js';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    initialized: false,
    isLoading: false,
    error: null,
    hotels: [],
    activeHotelId: null,
  });
});

afterEach(() => {
  // Clean up localStorage
  localStorage.clear();
});

// ── UC-001: Login ─────────────────────────────────────────────────────────────

describe('authStore – login (UC-001)', () => {
  it('sets isAuthenticated and token on successful login', async () => {
    api.auth.login.mockResolvedValueOnce({
      token: 'mock-jwt-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 'u1', email: 'admin@hotel.com', role: 'SUPER_ADMIN' },
      hotels: [{ id: 'hotel-1', hotel_name: 'Test Hotel' }],
    });

    const result = await useAuthStore.getState().login('admin@hotel.com', 'password');

    expect(result.success).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('mock-jwt-token');
    expect(state.refreshToken).toBe('mock-refresh-token');
    expect(state.user.email).toBe('admin@hotel.com');
    expect(state.activeHotelId).toBe('hotel-1'); // auto-selected when 1 hotel
  });

  it('sets error and keeps isAuthenticated false on login failure', async () => {
    api.auth.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    const result = await useAuthStore.getState().login('admin@hotel.com', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.error).toBe('Invalid credentials');
  });

  it('stores token and user in localStorage on success', async () => {
    api.auth.login.mockResolvedValueOnce({
      token: 'jwt-abc',
      refreshToken: 'refresh-xyz',
      user: { id: 'u1', email: 'test@test.com', role: 'MANAGER' },
      hotels: [{ id: 'hotel-1' }],
    });

    await useAuthStore.getState().login('test@test.com', 'pass');

    expect(localStorage.getItem('token')).toBe('jwt-abc');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-xyz');
    expect(JSON.parse(localStorage.getItem('user')).email).toBe('test@test.com');
  });

  it('sets isLoading true during login, false after', async () => {
    let resolveLogin;
    api.auth.login.mockReturnValueOnce(
      new Promise((res) => { resolveLogin = res; })
    );

    const loginPromise = useAuthStore.getState().login('test@test.com', 'pass');
    expect(useAuthStore.getState().isLoading).toBe(true);

    resolveLogin({
      token: 't', refreshToken: 'r',
      user: { id: '1', email: 'test@test.com', role: 'MANAGER' },
      hotels: [],
    });
    await loginPromise;
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ── UC-002: Logout ────────────────────────────────────────────────────────────

describe('authStore – logout (UC-002)', () => {
  it('clears auth state and localStorage on logout', async () => {
    // Simulate logged-in state
    localStorage.setItem('token', 'old-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com' }));

    useAuthStore.setState({
      isAuthenticated: true,
      token: 'old-token',
      user: { id: '1', email: 'a@b.com' },
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.activeHotelId).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});

// ── UC-003: Refresh token ─────────────────────────────────────────────────────

describe('authStore – refreshAccessToken (UC-003)', () => {
  it('updates token in state and localStorage on successful refresh', async () => {
    api.auth.refreshToken.mockResolvedValueOnce({
      token: 'new-token',
      refreshToken: 'new-refresh',
    });

    useAuthStore.setState({ refreshToken: 'old-refresh', isAuthenticated: true });
    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(true);
    expect(useAuthStore.getState().token).toBe('new-token');
    expect(localStorage.getItem('token')).toBe('new-token');
  });

  it('calls logout when no refresh token available', async () => {
    useAuthStore.setState({ refreshToken: null });
    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('calls logout on refresh failure', async () => {
    api.auth.refreshToken.mockRejectedValueOnce(new Error('Token expired'));

    useAuthStore.setState({ refreshToken: 'bad-refresh', isAuthenticated: true });
    const result = await useAuthStore.getState().refreshAccessToken();

    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// ── Hotel switching ───────────────────────────────────────────────────────────

describe('authStore – switchHotel (multi-tenancy)', () => {
  it('T4: switches activeHotelId when hotel exists in user hotels', () => {
    useAuthStore.setState({
      hotels: [
        { id: 'hotel-1', hotel_name: 'Hotel A' },
        { id: 'hotel-2', hotel_name: 'Hotel B' },
      ],
      activeHotelId: 'hotel-1',
    });

    const result = useAuthStore.getState().switchHotel('hotel-2');

    expect(result).toBe(true);
    expect(useAuthStore.getState().activeHotelId).toBe('hotel-2');
    expect(localStorage.getItem('activeHotelId')).toBe('hotel-2');
  });

  it('T5: returns false when switching to hotel not in user list', () => {
    useAuthStore.setState({
      hotels: [{ id: 'hotel-1', hotel_name: 'Hotel A' }],
      activeHotelId: 'hotel-1',
    });

    const result = useAuthStore.getState().switchHotel('hotel-999');

    expect(result).toBe(false);
    expect(useAuthStore.getState().activeHotelId).toBe('hotel-1'); // unchanged
  });
});
