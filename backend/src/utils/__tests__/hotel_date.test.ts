import { describe, it, expect } from 'vitest';
import { getLocalDateStringForTimezone } from '../hotel_date.js';

describe('hotel_date', () => {
  it('returns YYYY-MM-DD in America/New_York for a UTC instant', () => {
    const d = new Date('2024-06-15T03:59:00.000Z');
    expect(getLocalDateStringForTimezone(d, 'America/New_York')).toBe('2024-06-14');
  });

  it('defaults empty timezone to UTC behavior via caller', () => {
    const d = new Date('2024-01-10T12:00:00.000Z');
    expect(getLocalDateStringForTimezone(d, 'UTC')).toBe('2024-01-10');
  });
});
