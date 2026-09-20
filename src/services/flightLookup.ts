/**
 * Flight lookup: turn a flight number and a date into a filled-in flight.
 *
 * There is no free, keyless, browser-callable API that returns a scheduled
 * flight's route and times for an arbitrary date — every provider that does
 * that (AeroDataBox, FlightAware, AviationStack) wants a key. So CREW asks
 * three sources in order of how much they can be trusted, merges what comes
 * back, and labels every field with where it came from:
 *
 *   1. Your own history      — free, instant, offline. A pilot flies the same
 *                              flight numbers over and over, so the last time
 *                              you flew OH5142 is usually the right answer.
 *   2. Live ADS-B            — free and keyless, but only knows about
 *                              aircraft airborne right now. Fills in the tail.
 *   3. AeroDataBox           — the real schedule, if you have put a key in
 *                              Settings. Overrides the other two.
 *
 * Nothing is ever invented. A field no provider supplied comes back null and
 * the form leaves it empty for you to type.
 */

import { findAircraft } from '../data/aircraft';
import { findAirline, parseFlightNumber, toCallsign, toIataFlightNumber, type Airline } from '../data/airlines';
import { findAirport } from '../data/airportIndex';
import { AIRCRAFT } from '../data/aircraft';
import { dateKeyIn, instantFromLocal, minutesBetween, shiftDateKey } from '../core/time/time';
import type { Iso, LegStatus, Source, Trip } from '../core/types';
import type { CrewState } from '../store/state';
import { getJson, type Fetched } from './fetcher';

/** Which provider supplied a given field. */
export type FieldOrigin = 'history' | 'live' | 'schedule';

export interface FlightLookupResult {
  flightNumber: string;
  airline: Airline | null;
  from: string | null; // ICAO
  to: string | null; // ICAO
  depart: Iso | null;
  arrive: Iso | null;
  /** Only ever set when a source actually reported it — never derived from the clock. */
  actualDepart: Iso | null;
  actualArrive: Iso | null;
  status: LegStatus | null;
  blockMinutes: number | null;
  aircraftId: string | null;
  tail: string | null;
  /** field name -> which provider it came from. */
  origin: Partial<Record<keyof FlightLookupResult, FieldOrigin>>;
  sources: Source[];
  /** Plain-language notes the UI shows so nothing looks more certain than it is. */
  notes: string[];
}

const MERGEABLE_FIELDS = [
  'from', 'to', 'depart', 'arrive', 'actualDepart', 'actualArrive', 'status', 'blockMinutes', 'aircraftId', 'tail',
] as const;

function emptyResult(flightNumber: string, airline: Airline | null): FlightLookupResult {
  return {
    flightNumber,
    airline,
    from: null,
    to: null,
    depart: null,
    arrive: null,
    actualDepart: null,
    actualArrive: null,
    status: null,
    blockMinutes: null,
    aircraftId: null,
    tail: null,
    origin: {},
    sources: [],
    notes: [],
  };
}

/** Copy set fields from `patch` into `base`, recording where each came from. */
function merge(base: FlightLookupResult, patch: Partial<FlightLookupResult>, from: FieldOrigin): void {
  for (const f of MERGEABLE_FIELDS) {
    const v = patch[f];
    if (v === null || v === undefined) continue;
    // A later provider only overwrites an earlier one if it outranks it.
    const rank: Record<FieldOrigin, number> = { history: 1, live: 2, schedule: 3 };
    const current = base.origin[f];
    if (current && rank[current] >= rank[from]) continue;
    (base as unknown as Record<string, unknown>)[f] = v;
    base.origin[f] = from;
  }
}

// ---------------------------------------------------------------------------
// 1. Your own history
// ---------------------------------------------------------------------------

/**
 * Find the most recent time this flight number appears in the pilot's own
 * trips, and re-hang its wall-clock times on the requested date.
 *
 * This is a memory, not a schedule. The times were right the day they were
 * flown; the airline may have retimed the flight since, which is why the
 * result says so and every field stays editable.
 */
export function lookupFromHistory(
  number: string,
  date: string,
  trips: Trip[],
): Partial<FlightLookupResult> & { notes: string[] } {
  let best: { depart: Iso | null; arrive: Iso | null; leg: Trip['days'][number]['legs'][number]; when: number } | null = null;

  for (const trip of trips) {
    for (const day of trip.days) {
      for (const leg of day.legs) {
        if (!leg.flightNumber) continue;
        if (leg.flightNumber.replace(/\D/g, '') !== number) continue;
        const when = leg.depart ? new Date(leg.depart).getTime() : 0;
        if (!best || when > best.when) best = { depart: leg.depart, arrive: leg.arrive, leg, when };
      }
    }
  }

  if (!best) return { notes: [] };

  const leg = best.leg;
  const fromAp = findAirport(leg.from);
  const toAp = findAirport(leg.to);
  const notes: string[] = [];

  // Re-hang the same local times on the requested date.
  let depart: Iso | null = null;
  let arrive: Iso | null = null;
  if (best.depart && fromAp) {
    const hhmm = localHhMm(best.depart, fromAp.tz);
    const d = instantFromLocal(date, hhmm, fromAp.tz);
    depart = d ? d.toISOString() : null;

    if (best.arrive && toAp && d) {
      const arrHhMm = localHhMm(best.arrive, toAp.tz);
      let a = instantFromLocal(date, arrHhMm, toAp.tz);
      // The leg crossed midnight when it was flown, so it does again.
      if (a && a.getTime() < d.getTime()) a = instantFromLocal(shiftDateKey(date, 1), arrHhMm, toAp.tz);
      arrive = a ? a.toISOString() : null;
    }
  }

  const flownOn = best.depart && fromAp ? dateKeyIn(best.depart, fromAp.tz) : null;
  notes.push(
    flownOn
      ? `Times are from the last time this appeared in your trips (${flownOn}). The airline may have retimed it since — check before you rely on it.`
      : 'Route is from your own trip history.',
  );

  return {
    from: fromAp?.icao ?? leg.from,
    to: toAp?.icao ?? leg.to,
    depart,
    arrive,
    blockMinutes: depart && arrive ? minutesBetween(depart, arrive) : (leg.blockMinutes ?? null),
    aircraftId: leg.aircraftId ?? null,
    tail: leg.tail ?? null,
    notes,
  };
}

function localHhMm(iso: Iso, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(iso))
    .replace('24:', '00:');
}

// ---------------------------------------------------------------------------
// 2. Live ADS-B
// ---------------------------------------------------------------------------

const ADSB: Source = {
  name: 'adsb.lol (live ADS-B)',
  url: 'https://api.adsb.lol/',
  kind: 'reference',
};

interface AdsbAircraft {
  hex?: string;
  r?: string; // registration
  t?: string; // ICAO type code
  flight?: string;
  lat?: number;
  lon?: number;
}

/** Map an ADS-B type code such as "CRJ9" onto an aircraft CREW carries. */
export function aircraftIdFromIcaoType(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return AIRCRAFT.find((a) => a.icaoType.toUpperCase() === c)?.id ?? null;
}

/**
 * Ask a public ADS-B feed whether this callsign is in the air right now.
 * Only ever fills in the tail and type — it knows nothing about schedules.
 */
export async function lookupLive(
  callsign: string,
): Promise<Fetched<{ tail: string | null; aircraftId: string | null; typeCode: string | null; status: LegStatus }>> {
  return getJson({
    key: `flight.live.${callsign}`,
    url: `https://api.adsb.lol/v2/callsign/${encodeURIComponent(callsign)}`,
    source: ADSB,
    ttlMs: 60_000,
    parse: (raw) => {
      const list = (raw as { ac?: AdsbAircraft[] }).ac ?? [];
      const ac = list[0];
      if (!ac) throw new Error('Not airborne right now');
      return {
        tail: ac.r ? ac.r.toUpperCase() : null,
        aircraftId: aircraftIdFromIcaoType(ac.t),
        typeCode: ac.t ?? null,
        // Appearing in a live ADS-B feed at all means it is in the air —
        // this is observed, not inferred from a clock.
        status: 'enroute' as const,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 3. AeroDataBox (bring your own key)
// ---------------------------------------------------------------------------

const AERODATABOX: Source = {
  name: 'AeroDataBox',
  url: 'https://aerodatabox.com/',
  kind: 'reference',
};

interface AdbFlight {
  departure?: {
    airport?: { icao?: string; iata?: string };
    scheduledTime?: { utc?: string; local?: string };
    actualTime?: { utc?: string; local?: string };
    revisedTime?: { utc?: string; local?: string };
  };
  arrival?: {
    airport?: { icao?: string; iata?: string };
    scheduledTime?: { utc?: string; local?: string };
    actualTime?: { utc?: string; local?: string };
    revisedTime?: { utc?: string; local?: string };
  };
  aircraft?: { model?: string; reg?: string };
  number?: string;
  status?: string;
}

/**
 * AeroDataBox's own status vocabulary, mapped onto CREW's much smaller one.
 * Anything not recognised comes back null rather than a guess — an
 * unfamiliar status string is not evidence of any particular state.
 */
export function statusFromAdb(raw: string | undefined): LegStatus | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (['canceled', 'cancelled'].includes(s)) return 'cancelled';
  if (['landed', 'arrived'].includes(s)) return 'landed';
  if (['departed', 'enroute', 'en route', 'approaching', 'diverted'].includes(s)) return 'enroute';
  if (['expected', 'scheduled', 'checkin', 'check-in', 'boarding', 'gateclosed', 'gate closed', 'delayed', 'unknown'].includes(s)) {
    return 'scheduled';
  }
  return null;
}

/** Parse AeroDataBox's UTC timestamps, which look like "2026-09-18 10:00Z". */
export function parseAdbTime(value: string | undefined): Iso | null {
  if (!value) return null;
  const normalised = value.trim().replace(' ', 'T').replace(/Z$/, 'Z');
  const d = new Date(/Z$/.test(normalised) ? normalised : `${normalised}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Best-effort map from a free-text aircraft model onto CREW's fleet. */
export function aircraftIdFromModel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes('crj') && m.includes('900')) return 'crj900';
  if (m.includes('crj') && m.includes('700')) return 'crj700';
  if (m.includes('crj')) return 'crj200';
  if (m.includes('175')) return 'e175';
  if (m.includes('145')) return 'e145';
  if (m.includes('a220')) return 'a220-300';
  if (m.includes('a321')) return 'a321neo';
  if (m.includes('a319')) return 'a319';
  if (m.includes('737')) return 'b738';
  return null;
}

export async function lookupSchedule(
  iataFlightNumber: string,
  date: string,
  apiKey: string,
): Promise<Fetched<Partial<FlightLookupResult>>> {
  return getJson({
    key: `flight.adb.${iataFlightNumber}.${date}`,
    url: `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(iataFlightNumber)}/${date}?withAircraftImage=false&withLocation=false`,
    source: AERODATABOX,
    ttlMs: 6 * 3_600_000,
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
    },
    parse: (raw) => {
      const list = Array.isArray(raw) ? (raw as AdbFlight[]) : [];
      const f = list[0];
      if (!f) throw new Error('No flight found for that number and date');
      const from = findAirport(f.departure?.airport?.icao ?? f.departure?.airport?.iata);
      const to = findAirport(f.arrival?.airport?.icao ?? f.arrival?.airport?.iata);
      const depart = parseAdbTime(f.departure?.scheduledTime?.utc);
      const arrive = parseAdbTime(f.arrival?.scheduledTime?.utc);
      const actualDepart = parseAdbTime(f.departure?.actualTime?.utc ?? f.departure?.revisedTime?.utc);
      const actualArrive = parseAdbTime(f.arrival?.actualTime?.utc ?? f.arrival?.revisedTime?.utc);
      return {
        from: from?.icao ?? f.departure?.airport?.icao ?? null,
        to: to?.icao ?? f.arrival?.airport?.icao ?? null,
        depart,
        arrive,
        actualDepart,
        actualArrive,
        status: statusFromAdb(f.status),
        blockMinutes: depart && arrive ? minutesBetween(depart, arrive) : null,
        aircraftId: aircraftIdFromModel(f.aircraft?.model),
        tail: f.aircraft?.reg ? f.aircraft.reg.toUpperCase() : null,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

export interface LookupOptions {
  /** Treat the flight as today's for the live ADS-B step. */
  today?: string;
}

/**
 * Run every source that can say something about this flight and merge them.
 * Always resolves — a source that fails simply contributes nothing.
 */
export async function lookupFlight(
  input: string,
  date: string,
  state: CrewState,
  options: LookupOptions = {},
): Promise<FlightLookupResult | null> {
  const parsed = parseFlightNumber(input);
  if (!parsed) return null;

  // Fall back to the pilot's own airline when they type a bare number.
  const airline = parsed.airline ?? findAirline(state.pilot.airlineCode ?? null);
  const result = emptyResult(parsed.number, airline);

  // 1. History — synchronous, always available.
  const hist = lookupFromHistory(parsed.number, date, state.trips);
  if (hist.from) {
    merge(result, hist, 'history');
    result.notes.push(...hist.notes);
    result.sources.push({ name: 'Your CREW trip history', kind: 'user' });
  }

  // 2. Live ADS-B — only meaningful for a flight operating today.
  const today = options.today ?? dateKeyIn(new Date(), 'UTC');
  const callsign = toCallsign(parsed.number, airline);
  if (callsign && date === today) {
    const live = await lookupLive(callsign);
    if (live.data) {
      merge(result, live.data, 'live');
      result.sources.push(live.source);
      result.notes.push(`${callsign} is airborne now — tail and type are from its live ADS-B transmission.`);
    }
  }

  // 3. AeroDataBox — authoritative, needs a key.
  const key = state.integrations?.aeroDataBoxKey;
  const iataNumber = toIataFlightNumber(parsed.number, airline);
  if (key && iataNumber) {
    const sched = await lookupSchedule(iataNumber, date, key);
    if (sched.data) {
      merge(result, sched.data, 'schedule');
      result.sources.push(sched.source);
    } else if (sched.error) {
      result.notes.push(`AeroDataBox: ${sched.error}`);
    }
  }

  const foundAnything = Object.keys(result.origin).length > 0;
  if (!foundAnything) {
    result.notes.push(
      key
        ? 'Nothing found for that flight number and date. Fill it in by hand below.'
        : "CREW has not seen this flight number before and it is not airborne right now. Fill it in by hand, or add an AeroDataBox key in Settings to look up any flight on any date.",
    );
  }

  // A type we could not identify falls back to what the pilot actually flies.
  if (!result.aircraftId && state.pilot.fleet.length === 1) {
    result.aircraftId = state.pilot.fleet[0];
    result.origin.aircraftId = 'history';
  }

  return result;
}

export { findAircraft };
