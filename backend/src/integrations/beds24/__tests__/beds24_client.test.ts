import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Beds24Client } from '../beds24_client.js';
import {
  Beds24AuthenticationError,
  Beds24RateLimitError,
  Beds24NetworkError,
  Beds24CircuitBreakerError,
} from '../beds24_errors.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Beds24Client', () => {
  let client: Beds24Client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new Beds24Client('test-refresh-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should authenticate with invite code', async () => {
      const mockResponse = {
        refreshToken: 'new-refresh-token',
        expiresIn: 2592000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
        headers: new Headers(),
      });

      const result = await client.authenticate('invite-code-123');

      expect(result.refreshToken).toBe('new-refresh-token');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/authentication/setup'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            code: 'invite-code-123',
          }),
        })
      );
    });

    it('should refresh access token', async () => {
      const mockResponse = {
        token: 'access-token-123',
        expiresIn: 900, // 15 minutes
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockResponse }),
        headers: new Headers(),
      });

      const result = await client.refreshAccessToken('refresh-token-123');

      expect(result.token).toBe('access-token-123');
      expect(result.expiresIn).toBe(900);
    });

    it('should automatically refresh token when expired', async () => {
      // Mock token refresh
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { token: 'new-access-token', expiresIn: 900 },
          }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { type: 'tokenDetails' } }),
          headers: new Headers(),
        });

      // Set expired token
      (client as any).accessToken = 'old-token';
      (client as any).tokenExpiresAt = new Date(Date.now() - 1000);

      await client.getTokenDetails();

      // Should have called refresh
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const calls = (global.fetch as any).mock.calls;
      expect(calls[0][0]).toContain('/authentication/token');
      expect(calls[1][0]).toContain('/authentication/details');
    });
  });

  describe('Rate Limiting', () => {
    it('should throw rate limit error when limit exceeded', async () => {
      // Exhaust rate limit
      const rateLimiter = (client as any).rateLimiter;
      for (let i = 0; i < 101; i++) {
        rateLimiter.tryConsume();
      }

      await expect(client.getTokenDetails()).rejects.toThrow(Beds24RateLimitError);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      // Simulate 5 failures
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: { message: 'Server error' } }),
        headers: new Headers(),
      });

      const circuitBreaker = (client as any).circuitBreaker;

      // Make 5 failed requests
      for (let i = 0; i < 5; i++) {
        try {
          await client.getTokenDetails();
        } catch (error) {
          // Expected to fail
        }
      }

      // Circuit breaker should be open
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Next request should fail immediately
      await expect(client.getTokenDetails()).rejects.toThrow(Beds24CircuitBreakerError);
    });

    it('should allow requests when circuit is closed', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { token: 'token', expiresIn: 900 },
        }),
        headers: new Headers(),
      });

      await expect(client.refreshAccessToken('refresh-token')).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw authentication error on 401', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'AUTH_ERROR', message: 'Unauthorized' },
        }),
        headers: new Headers(),
      });

      await expect(client.refreshAccessToken('invalid-token')).rejects.toThrow(
        Beds24AuthenticationError
      );
    });

    it('should throw network error on timeout', async () => {
      (global.fetch as any).mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(client.refreshAccessToken('token')).rejects.toThrow(Beds24NetworkError);
    });
  });

  describe('Request Building', () => {
    it('should build query string correctly', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
        headers: new Headers(),
      });

      await client.makeRequest('/bookings', {
        method: 'GET',
        query: {
          propertyId: [1, 2],
          filter: 'new',
          includeGuests: true,
        },
      });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain('propertyId=1');
      expect(callUrl).toContain('propertyId=2');
      expect(callUrl).toContain('filter=new');
      expect(callUrl).toContain('includeGuests=true');
    });

    it('should include authentication header when required', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { token: 'access-token', expiresIn: 900 },
          }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: [] }),
          headers: new Headers(),
        });

      await client.makeRequest('/bookings');

      const callHeaders = (global.fetch as any).mock.calls[1][1].headers;
      expect(callHeaders.token).toBe('access-token');
    });
  });
});

