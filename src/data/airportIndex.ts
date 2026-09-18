/** Lookup helpers over the curated airport dataset. */

import type { Airport } from '../core/types';
import { AIRPORTS } from './airports';

const byIcao = new Map<string, Airport>();
const byIata = new Map<string, Airport>();

for (const a of AIRPORTS) {
  byIcao.set(a.icao.toUpperCase(), a);
  byIata.set(a.iata.toUpperCase(), a);
}

/** Resolve an ICAO or IATA code (or a bare 3-letter US code) to an airport. */
export function findAirport(code: string | null | undefined): Airport | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  return byIcao.get(c) ?? byIata.get(c) ?? (c.length === 3 ? byIcao.get('K' + c) ?? null : null);
}

/** Display code: IATA is what schedules and pilots actually use day to day. */
export function displayCode(code: string | null | undefined): string {
  const a = findAirport(code);
  return a ? a.iata : (code ?? '—').toUpperCase();
}

export function airportTz(code: string | null | undefined, fallback = 'UTC'): string {
  return findAirport(code)?.tz ?? fallback;
}

export function searchAirports(query: string, limit = 20): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.slice(0, limit);
  const scored: { a: Airport; score: number }[] = [];
  for (const a of AIRPORTS) {
    let score = -1;
    if (a.iata.toLowerCase() === q || a.icao.toLowerCase() === q) score = 100;
    else if (a.icao.toLowerCase().startsWith(q) || a.iata.toLowerCase().startsWith(q)) score = 80;
    else if (a.city.toLowerCase().startsWith(q)) score = 60;
    else if (a.name.toLowerCase().includes(q)) score = 40;
    else if (a.city.toLowerCase().includes(q)) score = 30;
    if (score >= 0) scored.push({ a, score });
  }
  scored.sort((x, y) => y.score - x.score || x.a.iata.localeCompare(y.a.iata));
  return scored.slice(0, limit).map((s) => s.a);
}

/** Longest runway, the number pilots reach for first. */
export function longestRunwayFt(a: Airport): number | null {
  if (a.runways.length === 0) return null;
  return Math.max(...a.runways.map((r) => r.lengthFt));
}

/** Split "18L/36R" into both usable landing directions with magnetic headings. */
export function runwayEnds(a: Airport): { ident: string; headingDeg: number; lengthFt: number }[] {
  const ends: { ident: string; headingDeg: number; lengthFt: number }[] = [];
  for (const r of a.runways) {
    const parts = r.ident.split('/');
    const base = r.headingDeg ?? Number(parts[0].replace(/\D/g, '')) * 10;
    parts.forEach((p, i) => {
      ends.push({ ident: p, headingDeg: (base + i * 180) % 360, lengthFt: r.lengthFt });
    });
  }
  return ends;
}

export { AIRPORTS };
