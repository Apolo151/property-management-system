import { format, isValid, parseISO } from 'date-fns';

/**
 * @param {string|Date|null|undefined} dateStr
 * @param {string} fmt - date-fns format string
 * @param {string} [fallback='—']
 */
export function safeFormat(dateStr, fmt, fallback = '—') {
  if (dateStr == null || dateStr === '') return fallback;
  try {
    const d = dateStr instanceof Date ? dateStr : parseISO(String(dateStr));
    if (!isValid(d)) return fallback;
    return format(d, fmt);
  } catch {
    return fallback;
  }
}
