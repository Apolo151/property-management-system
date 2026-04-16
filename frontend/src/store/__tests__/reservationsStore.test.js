/**
 * Reservations Store Unit Tests
 *
 * Tests Zustand state management for reservations (UC-301–UC-312).
 * Mocks the api module — no real network calls.
 *
 * Run: cd frontend && npx vitest src/store/__tests__/reservationsStore.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/api.js', () => ({
  api: {
    reservations: {
      getAll: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      checkAvailability: vi.fn(),
    },
  },
}));

vi.mock('../../store/storeRegistry.js', () => ({
  registerDomainReset: vi.fn(),
}));

import { api } from '../../utils/api.js';

let useReservationsStore;

beforeEach(async () => {
  vi.resetModules();
  vi.mock('../../utils/api.js', () => ({
    api: {
      reservations: {
        getAll: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        checkAvailability: vi.fn(),
      },
    },
  }));
  vi.mock('../../store/storeRegistry.js', () => ({
    registerDomainReset: vi.fn(),
  }));
  const module = await import('../../store/reservationsStore.js');
  useReservationsStore = module.default;
});

// Sample API response
const mockApiReservation = {
  id: 'rv-1',
  primary_guest_id: 'g-1',
  primary_guest_name: 'Alice Smith',
  primary_guest_email: 'alice@test.com',
  primary_guest_phone: '+1-555-0001',
  secondary_guest_id: null,
  secondary_guest_name: null,
  room_type_id: 'rt-1',
  room_type_name: 'Standard Single',
  check_in: '2026-05-01',
  check_out: '2026-05-03',
  status: 'Confirmed',
  total_amount: 160,
  source: 'direct',
  special_requests: null,
  created_at: '2026-04-01T10:00:00Z',
  updated_at: '2026-04-01T10:00:00Z',
};

// ── UC-302: fetchReservations ──────────────────────────────────────────────────

describe('reservationsStore – fetchReservations (UC-302)', () => {
  it('RV3: populates reservations list on success', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    mockApi.reservations.getAll.mockResolvedValueOnce([mockApiReservation]);

    await useReservationsStore.getState().fetchReservations();

    const state = useReservationsStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.reservations).toHaveLength(1);
    // Verify field transformation
    expect(state.reservations[0].guestName).toBe('Alice Smith');
    expect(state.reservations[0].checkIn).toBe('2026-05-01');
    expect(state.reservations[0].status).toBe('Confirmed');
  });

  it('sets error on API failure', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    mockApi.reservations.getAll.mockRejectedValueOnce(new Error('Network error'));

    await expect(useReservationsStore.getState().fetchReservations()).rejects.toThrow('Network error');

    const state = useReservationsStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network error');
  });
});

// ── UC-301: createReservation ─────────────────────────────────────────────────

describe('reservationsStore – createReservation (UC-301)', () => {
  it('RV1: prepends new reservation to the list', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    // Set initial state
    useReservationsStore.setState({ reservations: [{ id: 'existing-rv', status: 'Confirmed' }] });

    mockApi.reservations.create.mockResolvedValueOnce({
      ...mockApiReservation,
      id: 'new-rv',
    });

    const result = await useReservationsStore.getState().createReservation({
      guestId: 'g-1',
      roomTypeId: 'rt-1',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
    });

    expect(result.id).toBe('new-rv');
    const state = useReservationsStore.getState();
    expect(state.reservations[0].id).toBe('new-rv'); // prepended
    expect(state.reservations).toHaveLength(2);
    expect(state.loading).toBe(false);
  });

  it('transforms camelCase input to snake_case API payload', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    mockApi.reservations.create.mockResolvedValueOnce(mockApiReservation);

    await useReservationsStore.getState().createReservation({
      guestId: 'g-1',
      roomTypeId: 'rt-1',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      status: 'Confirmed',
    });

    const callArg = mockApi.reservations.create.mock.calls[0][0];
    expect(callArg.primary_guest_id).toBe('g-1');
    expect(callArg.room_type_id).toBe('rt-1');
    expect(callArg.check_in).toBe('2026-06-01');
    expect(callArg.check_out).toBe('2026-06-03');
  });
});

// ── UC-303/304: updateReservation ─────────────────────────────────────────────

describe('reservationsStore – updateReservation (UC-303/304)', () => {
  it('RV4: updates the reservation in state (cancel)', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    useReservationsStore.setState({
      reservations: [{ id: 'rv-1', status: 'Confirmed', guestName: 'Alice' }],
    });

    const cancelledRv = { ...mockApiReservation, status: 'Cancelled' };
    mockApi.reservations.update.mockResolvedValueOnce(cancelledRv);

    await useReservationsStore.getState().updateReservation('rv-1', { status: 'Cancelled' });

    const state = useReservationsStore.getState();
    const updated = state.reservations.find((r) => r.id === 'rv-1');
    expect(updated.status).toBe('Cancelled');
  });
});

// ── deleteReservation ─────────────────────────────────────────────────────────

describe('reservationsStore – deleteReservation', () => {
  it('removes reservation from list on success', async () => {
    const { api: mockApi } = await import('../../utils/api.js');
    useReservationsStore.setState({
      reservations: [
        { id: 'rv-1', status: 'Confirmed' },
        { id: 'rv-2', status: 'Confirmed' },
      ],
    });
    mockApi.reservations.delete.mockResolvedValueOnce({});

    await useReservationsStore.getState().deleteReservation('rv-1');

    const ids = useReservationsStore.getState().reservations.map((r) => r.id);
    expect(ids).not.toContain('rv-1');
    expect(ids).toContain('rv-2');
  });
});
