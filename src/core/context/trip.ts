/**
 * Everything the app derives from a Trip.
 *
 * Preflight, weather, layover, pay and statistics all read these functions
 * rather than recomputing durations for themselves — that is the whole point
 * of having one trip model.
 */

import { findAirport } from '../../data/airportIndex';
import type { DutyDay, Leg, Minutes, Preferences, Trip } from '../types';
import { minutesBetween, parseIso } from '../time/time';

/** Scheduled block time for a leg. Null when the times are not known. */
export function legBlockMinutes(leg: Leg): Minutes | null {
  if (leg.blockMinutes !== null && leg.blockMinutes !== undefined) return leg.blockMinutes;
  return minutesBetween(leg.depart, leg.arrive);
}

/** Flight time flown by the crew — deadheads do not count. */
export function dayFlightMinutes(day: DutyDay): Minutes | null {
  const flown = day.legs.filter((l) => l.kind === 'flight');
  if (flown.length === 0) return 0;
  let total = 0;
  let sawAny = false;
  for (const l of flown) {
    const b = legBlockMinutes(l);
    if (b !== null) {
      total += b;
      sawAny = true;
    }
  }
  return sawAny ? total : null;
}

/** All block time on the day, deadheads included. */
export function dayBlockMinutes(day: DutyDay): Minutes | null {
  let total = 0;
  let sawAny = false;
  for (const l of day.legs) {
    const b = legBlockMinutes(l);
    if (b !== null) {
      total += b;
      sawAny = true;
    }
  }
  return sawAny ? total : null;
}

/**
 * Scheduled duty for the day: report to release. Falls back to first
 * departure -> last arrival when report/release are not published, and says
 * so via the returned `basis` so the UI never implies more than it knows.
 */
export function dayDutyMinutes(day: DutyDay): { minutes: Minutes | null; basis: 'published' | 'derived' | 'unknown' } {
  if (day.reportAt && day.releaseAt) {
    return { minutes: minutesBetween(day.reportAt, day.releaseAt), basis: 'published' };
  }
  const first = day.legs.find((l) => l.depart);
  const last = [...day.legs].reverse().find((l) => l.arrive);
  if (first?.depart && last?.arrive) {
    return { minutes: minutesBetween(first.depart, last.arrive), basis: 'derived' };
  }
  return { minutes: null, basis: 'unknown' };
}

export function tripFlightMinutes(trip: Trip): Minutes | null {
  let total = 0;
  let sawAny = false;
  for (const d of trip.days) {
    const m = dayFlightMinutes(d);
    if (m !== null) {
      total += m;
      sawAny = true;
    }
  }
  return sawAny ? total : null;
}

export function tripBlockMinutes(trip: Trip): Minutes | null {
  let total = 0;
  let sawAny = false;
  for (const d of trip.days) {
    const m = dayBlockMinutes(d);
    if (m !== null) {
      total += m;
      sawAny = true;
    }
  }
  return sawAny ? total : null;
}

export function tripLegCount(trip: Trip): number {
  return trip.days.reduce((n, d) => n + d.legs.length, 0);
}

/** Time away from base: first report to last release. */
export function timeAwayMinutes(trip: Trip): Minutes | null {
  const start = tripStart(trip);
  const end = tripEnd(trip);
  return start && end ? minutesBetween(start, end) : null;
}

export function tripStart(trip: Trip): Date | null {
  for (const d of trip.days) {
    const r = parseIso(d.reportAt);
    if (r) return r;
    const dep = d.legs.map((l) => parseIso(l.depart)).find(Boolean);
    if (dep) return dep;
  }
  return null;
}

export function tripEnd(trip: Trip): Date | null {
  for (let i = trip.days.length - 1; i >= 0; i--) {
    const d = trip.days[i];
    const rel = parseIso(d.releaseAt);
    if (rel) return rel;
    const arrivals = d.legs.map((l) => parseIso(l.arrive)).filter(Boolean) as Date[];
    if (arrivals.length) return arrivals[arrivals.length - 1];
  }
  return null;
}

export interface LayoverInfo {
  /** Index of the duty day the layover follows. */
  afterDayIndex: number;
  airport: string; // ICAO
  city: string;
  start: Date;
  end: Date;
  minutes: Minutes;
  hotel: DutyDay['hotel'];
}

/** Every overnight in the trip: release to the next report. */
export function tripLayovers(trip: Trip): LayoverInfo[] {
  const out: LayoverInfo[] = [];
  for (let i = 0; i < trip.days.length - 1; i++) {
    const day = trip.days[i];
    const next = trip.days[i + 1];
    const end =
      parseIso(day.releaseAt) ??
      ([...day.legs].reverse().map((l) => parseIso(l.arrive)).find(Boolean) ?? null);
    const start =
      parseIso(next.reportAt) ?? (next.legs.map((l) => parseIso(l.depart)).find(Boolean) ?? null);
    if (!end || !start) continue;
    const lastLeg = [...day.legs].reverse().find((l) => l.arrive) ?? day.legs[day.legs.length - 1];
    const code = lastLeg?.to;
    const ap = findAirport(code);
    const mins = minutesBetween(end, start);
    if (mins === null || mins <= 0) continue;
    out.push({
      afterDayIndex: i,
      airport: ap?.icao ?? (code ?? ''),
      city: ap?.city ?? (code ?? 'Unknown'),
      start: end,
      end: start,
      minutes: mins,
      hotel: day.hotel ?? null,
    });
  }
  return out;
}

/**
 * When to walk out of the door.
 *
 * report - airport buffer - commute. This is a planning aid built from the
 * pilot's own settings, not a company-published time.
 */
export function leaveHomeAt(reportAt: string | Date | null, prefs: Preferences): Date | null {
  const r = reportAt instanceof Date ? reportAt : parseIso(reportAt);
  if (!r) return null;
  return new Date(r.getTime() - (prefs.airportBufferMinutes + prefs.commuteMinutes) * 60_000);
}

/** Airports touched by a trip, in the order they are first visited. */
export function tripAirports(trip: Trip): string[] {
  const seen: string[] = [];
  for (const d of trip.days) {
    for (const l of d.legs) {
      for (const c of [l.from, l.to]) {
        const ap = findAirport(c);
        const key = ap?.icao ?? c;
        if (key && !seen.includes(key)) seen.push(key);
      }
    }
  }
  return seen;
}

/** Compact route line: "DAY → CLT → DCA → DAY". */
export function routeLine(day: DutyDay): string {
  if (day.legs.length === 0) return '—';
  const codes: string[] = [];
  for (const l of day.legs) {
    const from = findAirport(l.from)?.iata ?? l.from;
    const to = findAirport(l.to)?.iata ?? l.to;
    if (codes.length === 0) codes.push(from);
    else if (codes[codes.length - 1] !== from) codes.push(from);
    codes.push(to);
  }
  return codes.join(' → ');
}

/** The duty day containing, or next after, a given instant. */
export function activeDayIndex(trip: Trip, now: Date): number {
  for (let i = 0; i < trip.days.length; i++) {
    const d = trip.days[i];
    const end =
      parseIso(d.releaseAt) ??
      ([...d.legs].reverse().map((l) => parseIso(l.arrive)).find(Boolean) ?? null);
    if (!end || end.getTime() > now.getTime()) return i;
  }
  return trip.days.length - 1;
}
