import type { Knex } from 'knex';

/**
 * Calendar date (YYYY-MM-DD) for an instant in a given IANA timezone.
 */
export function getLocalDateStringForTimezone(instant: Date, timeZone: string): string {
  const tz = timeZone?.trim() || 'UTC';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Resolve property timezone from `hotels` (multi-property schema).
 */
export async function getHotelTimezone(client: Knex | Knex.Transaction, hotelId: string): Promise<string> {
  const row = await client('hotels').where({ id: hotelId }).whereNull('deleted_at').first();
  const tz = row?.timezone;
  if (typeof tz === 'string' && tz.trim()) {
    return tz.trim();
  }
  return 'UTC';
}
