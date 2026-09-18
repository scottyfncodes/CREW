/**
 * Time handling for CREW.
 *
 * Airline schedules are local-time documents flying across timezones, so every
 * helper here is explicit about which zone it is working in. We lean on
 * Intl.DateTimeFormat rather than shipping a timezone library — the browser
 * already carries the IANA database.
 */

import type { Iso, Minutes } from '../types';

export const MIN = 60_000;
export const HOUR = 60 * MIN;

/** Parse an ISO instant. Returns null for missing/unparseable input. */
export function parseIso(iso: Iso | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole minutes between two instants. Negative if `b` precedes `a`. */
export function minutesBetween(a: Iso | Date | null, b: Iso | Date | null): Minutes | null {
  const da = a instanceof Date ? a : parseIso(a);
  const db = b instanceof Date ? b : parseIso(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / MIN);
}

export function addMinutes(iso: Iso | Date, minutes: Minutes): Date {
  const d = iso instanceof Date ? new Date(iso.getTime()) : new Date(iso);
  return new Date(d.getTime() + minutes * MIN);
}

/** "5h 18m" / "48m" / "0m". Negative durations keep their sign. */
export function formatDuration(minutes: Minutes | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}m`;
}

/** Decimal hours, the way pay and logbooks are written. 95 -> "1.6". */
export function formatHoursDecimal(minutes: Minutes | null | undefined, places = 1): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  return (minutes / 60).toFixed(places);
}

const timeFmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = timeFmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });
    timeFmtCache.set(key, f);
  }
  return f;
}

/** Wall-clock time in a zone, 24h by default: "05:15". */
export function timeIn(iso: Iso | Date | null, tz: string, use24h = true): string {
  const d = iso instanceof Date ? iso : parseIso(iso);
  if (!d) return '—';
  return fmt(tz, { hour: '2-digit', minute: '2-digit', hour12: !use24h }).format(d);
}

/** "Fri 18 Sep" in the given zone. */
export function dateIn(iso: Iso | Date | null, tz: string): string {
  const d = iso instanceof Date ? iso : parseIso(iso);
  if (!d) return '—';
  return fmt(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

/** Calendar date key "YYYY-MM-DD" in the given zone. */
export function dateKeyIn(iso: Iso | Date | null, tz: string): string | null {
  const d = iso instanceof Date ? iso : parseIso(iso);
  if (!d) return null;
  const parts = fmt(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Zone abbreviation as the browser renders it: "EDT". */
export function zoneAbbr(iso: Iso | Date | null, tz: string): string {
  const d = iso instanceof Date ? iso : parseIso(iso);
  if (!d) return '';
  const parts = fmt(tz, { timeZoneName: 'short' }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** UTC offset of a zone at an instant, in minutes east of Greenwich. */
export function offsetMinutes(at: Date, tz: string): Minutes {
  // Format the instant as if it were in `tz`, read it back as UTC, and the
  // difference is the offset. Stable across DST because it is instant-based.
  const parts = fmt(tz, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MIN);
}

/** Hours of clock change moving from one zone to another at an instant. */
export function zoneShiftMinutes(at: Date, fromTz: string, toTz: string): Minutes {
  return offsetMinutes(at, toTz) - offsetMinutes(at, fromTz);
}

/**
 * Build an instant from a wall-clock time in a zone.
 * `date` is "YYYY-MM-DD", `time` is "HH:MM", both as read off the schedule.
 */
export function instantFromLocal(date: string, time: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hh, mm] = [Number(t[1]), Number(t[2])];
  if (hh > 23 || mm > 59) return null;
  // Start from the naive UTC reading, then correct by that zone's offset. One
  // correction pass is enough except across a DST boundary, so we iterate twice.
  let guess = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  for (let i = 0; i < 2; i++) {
    const off = offsetMinutes(guess, tz);
    const corrected = new Date(Date.UTC(y, mo - 1, d, hh, mm) - off * MIN);
    if (corrected.getTime() === guess.getTime()) break;
    guess = corrected;
  }
  return guess;
}

/** Add days to a "YYYY-MM-DD" key without touching timezones. */
export function shiftDateKey(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Local hour (0-23) at an instant in a zone. Used to time-of-day-aware logic. */
export function hourIn(at: Iso | Date, tz: string): number {
  const d = at instanceof Date ? at : parseIso(at);
  if (!d) return 12;
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(d));
  return h === 24 ? 0 : h;
}

/** Relative phrasing for the home screen: "in 3h 12m" / "2h ago" / "now". */
export function relative(target: Iso | Date | null, now: Date): string {
  const mins = minutesBetween(now, target);
  if (mins === null) return '—';
  if (Math.abs(mins) < 2) return 'now';
  return mins > 0 ? `in ${formatDuration(mins)}` : `${formatDuration(-mins)} ago`;
}
