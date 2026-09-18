/**
 * Personal flying statistics — the "my aviation history" layer.
 *
 * Everything here is derived from the pilot's own logbook records; nothing is
 * fetched or inferred from outside.
 */

import { findAirport } from '../../data/airportIndex';
import { greatCircleNm } from '../calc/navigation';
import type { FlightRecord, Minutes, Tail } from '../types';

export interface AirportVisit {
  icao: string;
  iata: string;
  city: string;
  visits: number;
  first: string;
  last: string;
}

export interface FleetEntry {
  tail: string;
  aircraftId: string;
  flights: number;
  first: string | null;
  last: string | null;
  blockMinutes: Minutes;
}

export interface LogbookTotals {
  flights: number;
  blockMinutes: Minutes;
  distanceNm: number;
  airports: number;
  tails: number;
  types: number;
  longestLeg: { from: string; to: string; nm: number } | null;
  busiestMonth: { month: string; flights: number } | null;
}

export function airportVisits(flights: FlightRecord[]): AirportVisit[] {
  const map = new Map<string, AirportVisit>();
  const touch = (code: string, date: string) => {
    const ap = findAirport(code);
    const key = ap?.icao ?? code;
    const existing = map.get(key);
    if (existing) {
      existing.visits++;
      if (date < existing.first) existing.first = date;
      if (date > existing.last) existing.last = date;
    } else {
      map.set(key, {
        icao: key,
        iata: ap?.iata ?? code,
        city: ap?.city ?? code,
        visits: 1,
        first: date,
        last: date,
      });
    }
  };
  for (const f of flights) {
    touch(f.from, f.date);
    touch(f.to, f.date);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || a.iata.localeCompare(b.iata));
}

export function fleetFromLog(flights: FlightRecord[], tails: Tail[]): FleetEntry[] {
  const map = new Map<string, FleetEntry>();
  for (const t of tails) {
    map.set(t.registration.toUpperCase(), {
      tail: t.registration.toUpperCase(),
      aircraftId: t.aircraftId,
      flights: 0,
      first: t.firstFlownByMe ?? null,
      last: t.lastFlownByMe ?? null,
      blockMinutes: 0,
    });
  }
  for (const f of flights) {
    if (!f.tail) continue;
    const key = f.tail.toUpperCase();
    const e = map.get(key) ?? {
      tail: key,
      aircraftId: f.aircraftId,
      flights: 0,
      first: null,
      last: null,
      blockMinutes: 0,
    };
    e.flights++;
    e.blockMinutes += f.blockMinutes;
    if (!e.first || f.date < e.first) e.first = f.date;
    if (!e.last || f.date > e.last) e.last = f.date;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.flights - a.flights || a.tail.localeCompare(b.tail));
}

export function legDistanceNm(from: string, to: string): number | null {
  const a = findAirport(from);
  const b = findAirport(to);
  if (!a || !b) return null;
  return greatCircleNm(a.pos, b.pos);
}

export function logbookTotals(flights: FlightRecord[], tails: Tail[]): LogbookTotals {
  let blockMinutes = 0;
  let distanceNm = 0;
  let longest: LogbookTotals['longestLeg'] = null;
  const months = new Map<string, number>();
  const types = new Set<string>();

  for (const f of flights) {
    blockMinutes += f.blockMinutes;
    types.add(f.aircraftId);
    const d = legDistanceNm(f.from, f.to);
    if (d !== null) {
      distanceNm += d;
      if (!longest || d > longest.nm) longest = { from: f.from, to: f.to, nm: d };
    }
    const month = f.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
  }

  let busiest: LogbookTotals['busiestMonth'] = null;
  for (const [month, count] of months) {
    if (!busiest || count > busiest.flights) busiest = { month, flights: count };
  }

  return {
    flights: flights.length,
    blockMinutes,
    distanceNm: Math.round(distanceNm),
    airports: airportVisits(flights).length,
    tails: fleetFromLog(flights, tails).filter((t) => t.flights > 0 || tails.length > 0).length,
    types: types.size,
    longestLeg: longest,
    busiestMonth: busiest,
  };
}

/** Block time by calendar month, newest first — for the Off Duty screen. */
export function monthlyBlock(flights: FlightRecord[]): { month: string; minutes: Minutes; flights: number }[] {
  const map = new Map<string, { minutes: Minutes; flights: number }>();
  for (const f of flights) {
    const m = f.date.slice(0, 7);
    const e = map.get(m) ?? { minutes: 0, flights: 0 };
    e.minutes += f.blockMinutes;
    e.flights++;
    map.set(m, e);
  }
  return [...map.entries()]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
