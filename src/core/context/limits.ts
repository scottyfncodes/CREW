/**
 * Flight-time limits — how close is pilot-me to the FAR 117 cumulative caps?
 *
 * 14 CFR 117.23(b) limits flight time to 100 hours in any 672 consecutive
 * hours and 1,000 hours in any 365 consecutive calendar days. 117.11 caps
 * flight time within a single flight duty period at 8 or 9 hours depending on
 * the time the duty starts.
 *
 * Logbook records carry a date, not an instant, so the 672-hour window is
 * read as 28 calendar days. That is an approximation and is labelled as one
 * wherever it is shown. This is a personal awareness tool, never a legality
 * determination — the company's crew-tracking system is the source of truth.
 */

import { findAirport } from '../../data/airportIndex';
import type { DutyDay, FlightRecord, Minutes, Trip } from '../types';
import { dateKeyIn, hourIn, parseIso, shiftDateKey } from '../time/time';
import { legBlockMinutes } from './trip';

export const LIMIT_28_DAY_MIN: Minutes = 100 * 60;
export const LIMIT_365_DAY_MIN: Minutes = 1000 * 60;

export interface FlightTimeSample {
  /** YYYY-MM-DD, local to the departure airport. */
  date: string;
  minutes: Minutes;
  source: 'logbook' | 'schedule';
}

/**
 * Every piece of flight time CREW knows about: the logbook, plus flown legs
 * on the schedule that are not in the logbook yet (flown-but-unreviewed, or
 * still to come). A scheduled leg already logged is counted once, from the
 * logbook. Deadheads and cancelled legs are not flight time.
 */
export function flightTimeSamples(flights: FlightRecord[], trips: Trip[]): FlightTimeSample[] {
  const out: FlightTimeSample[] = flights.map((f) => ({ date: f.date, minutes: f.blockMinutes, source: 'logbook' }));
  const logged = new Set(flights.map((f) => f.sourceLegId).filter(Boolean));
  for (const trip of trips) {
    for (const day of trip.days) {
      for (const leg of day.legs) {
        if (leg.kind !== 'flight' || leg.status === 'cancelled' || logged.has(leg.id)) continue;
        const minutes = legBlockMinutes(leg);
        if (minutes === null) continue;
        const tz = findAirport(leg.from)?.tz ?? 'UTC';
        const date = dateKeyIn(leg.depart, tz) ?? day.date;
        out.push({ date, minutes, source: 'schedule' });
      }
    }
  }
  return out;
}

/** Flight time in the `days` calendar days ending on `endDate`, inclusive. */
export function windowMinutes(samples: FlightTimeSample[], endDate: string, days: number): Minutes {
  const start = shiftDateKey(endDate, -(days - 1));
  let total = 0;
  for (const s of samples) if (s.date >= start && s.date <= endDate) total += s.minutes;
  return total;
}

export interface CumulativeLimit {
  label: string;
  days: number;
  limitMinutes: Minutes;
  /** Total in the window ending today, today's scheduled flying included. */
  todayMinutes: Minutes;
  /** Highest window total from today through the last scheduled day. */
  peak: { date: string; minutes: Minutes };
}

export interface LimitsSummary {
  today: string;
  limits: CumulativeLimit[];
  /** Whether any of the totals lean on scheduled, not yet logged, flying. */
  includesSchedule: boolean;
}

export function cumulativeLimits(flights: FlightRecord[], trips: Trip[], today: string): LimitsSummary {
  const samples = flightTimeSamples(flights, trips);
  const lastDate = samples.reduce((max, s) => (s.date > max ? s.date : max), today);

  const build = (label: string, days: number, limitMinutes: Minutes): CumulativeLimit => {
    const todayMinutes = windowMinutes(samples, today, days);
    let peak = { date: today, minutes: todayMinutes };
    for (let d = shiftDateKey(today, 1); d <= lastDate; d = shiftDateKey(d, 1)) {
      const m = windowMinutes(samples, d, days);
      if (m > peak.minutes) peak = { date: d, minutes: m };
    }
    return { label, days, limitMinutes, todayMinutes, peak };
  };

  return {
    today,
    limits: [build('28 days', 28, LIMIT_28_DAY_MIN), build('365 days', 365, LIMIT_365_DAY_MIN)],
    includesSchedule: samples.some((s) => s.source === 'schedule' && s.date >= shiftDateKey(today, -364)),
  };
}

export type LimitTone = 'go' | 'caution' | 'warn';

/** Over the limit is a warning; within 10% of it is worth a look. */
export function limitTone(minutes: Minutes, limitMinutes: Minutes): LimitTone {
  if (minutes > limitMinutes) return 'warn';
  if (minutes >= limitMinutes * 0.9) return 'caution';
  return 'go';
}

export interface DutyFlightTime {
  flightMinutes: Minutes | null;
  /** 8h or 9h, from Table B of Part 117. Null when the start time is unknown. */
  limitMinutes: Minutes | null;
  /** Local hour the duty starts, which decides the limit. */
  startHour: number | null;
}

/**
 * Part 117 Table B: a flight duty period starting 05:00–19:59 allows 9 hours
 * of flight time, any other start allows 8. The start is read in the local
 * time at the first departure airport, which assumes the pilot is acclimated
 * there — the usual case on a domestic regional pairing, but still an
 * assumption, and the UI says so.
 */
export function dutyFlightTime(day: DutyDay): DutyFlightTime {
  const flown = day.legs.filter((l) => l.kind === 'flight' && l.status !== 'cancelled');
  let flightMinutes: Minutes | null = flown.length === 0 ? 0 : null;
  for (const l of flown) {
    const b = legBlockMinutes(l);
    if (b !== null) flightMinutes = (flightMinutes ?? 0) + b;
  }

  const firstLeg = day.legs[0];
  const start = parseIso(day.reportAt) ?? parseIso(firstLeg?.depart);
  const tz = findAirport(firstLeg?.from)?.tz;
  if (!start || !tz) return { flightMinutes, limitMinutes: null, startHour: null };
  const startHour = hourIn(start, tz);
  const limitMinutes = startHour >= 5 && startHour < 20 ? 9 * 60 : 8 * 60;
  return { flightMinutes, limitMinutes, startHour };
}
