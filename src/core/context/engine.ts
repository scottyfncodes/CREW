/**
 * The context engine.
 *
 * One question: what is pilot-me doing right now? Everything on the home
 * screen, and most of what the rest of the app defaults to, is decided here
 * rather than in a component. Pure and time-injectable so it can be tested.
 */

import { findAirport } from '../../data/airportIndex';
import type { DutyDay, Leg, Pilot, Trip } from '../types';
import { minutesBetween, parseIso } from '../time/time';
import { activeDayIndex, leaveHomeAt, tripLayovers, type LayoverInfo } from './trip';

export type ContextState =
  | 'no-trip'
  | 'pre-trip'
  | 'leave-soon'
  | 'on-duty'
  | 'layover'
  | 'trip-complete';

export interface PilotContext {
  now: Date;
  state: ContextState;
  trip: Trip | null;
  dayIndex: number;
  day: DutyDay | null;
  /** The leg currently airborne, if any. */
  currentLeg: Leg | null;
  /** The next leg to operate today. */
  nextLeg: Leg | null;
  /** Minutes until the next leg pushes, when known. */
  minutesToNextLeg: number | null;
  reportAt: Date | null;
  releaseAt: Date | null;
  leaveHome: Date | null;
  minutesToReport: number | null;
  minutesToLeaveHome: number | null;
  /** Best guess at which airport the pilot is at or heading for. */
  locationIcao: string | null;
  /** The layover in progress, if the pilot is on one. */
  layover: LayoverInfo | null;
  /** Layover coming up later in this trip. */
  nextLayover: LayoverInfo | null;
  /** Local part of day where the pilot is. Drives greeting and card order. */
  partOfDay: 'early' | 'morning' | 'afternoon' | 'evening' | 'night';
}

/** 'early' means the pre-dawn show-time window, which pilots live in. */
export function partOfDayFor(now: Date, tz: string): PilotContext['partOfDay'] {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(now),
  );
  const h = hour === 24 ? 0 : hour;
  // 'early' starts at 03:00, not 05:00: a pilot on an 05:15 report is up at
  // 03:30 and starting their day, not finishing a late one.
  if (h < 3) return 'night';
  if (h < 9) return 'early';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

/** How far ahead a trip counts as "coming up" rather than "later". */
const PRE_TRIP_HORIZON_MIN = 36 * 60;

export function buildContext(pilot: Pilot, trip: Trip | null, now: Date): PilotContext {
  const homeTz = findAirport(pilot.homeAirport)?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const base: PilotContext = {
    now,
    state: 'no-trip',
    trip,
    dayIndex: -1,
    day: null,
    currentLeg: null,
    nextLeg: null,
    minutesToNextLeg: null,
    reportAt: null,
    releaseAt: null,
    leaveHome: null,
    minutesToReport: null,
    minutesToLeaveHome: null,
    locationIcao: pilot.homeAirport,
    layover: null,
    nextLayover: null,
    partOfDay: partOfDayFor(now, homeTz),
  };

  if (!trip || trip.days.length === 0) return base;

  const layovers = tripLayovers(trip);
  const activeLayover =
    layovers.find((l) => now >= l.start && now < l.end) ?? null;
  const nextLayover = layovers.find((l) => l.start > now) ?? null;

  const dayIndex = activeDayIndex(trip, now);
  const day = trip.days[dayIndex] ?? null;
  const reportAt = parseIso(day?.reportAt ?? null);
  const releaseAt = parseIso(day?.releaseAt ?? null);
  const leaveHome =
    dayIndex === 0 && reportAt ? leaveHomeAt(reportAt, pilot.prefs) : null;

  // Legs
  let currentLeg: Leg | null = null;
  let nextLeg: Leg | null = null;
  if (day) {
    for (const l of day.legs) {
      const dep = parseIso(l.depart);
      const arr = parseIso(l.arrive);
      if (dep && arr && now >= dep && now < arr) currentLeg = l;
      if (dep && dep > now && !nextLeg) nextLeg = l;
    }
  }

  // Where is the pilot?
  let locationIcao: string | null = pilot.homeAirport;
  if (activeLayover) locationIcao = activeLayover.airport;
  else if (currentLeg) locationIcao = findAirport(currentLeg.to)?.icao ?? currentLeg.to;
  else if (nextLeg) locationIcao = findAirport(nextLeg.from)?.icao ?? nextLeg.from;
  else if (day?.legs.length) {
    const last = [...day.legs].reverse().find((l) => parseIso(l.arrive) && parseIso(l.arrive)! <= now);
    if (last) locationIcao = findAirport(last.to)?.icao ?? last.to;
  }

  const locationTz = findAirport(locationIcao)?.tz ?? homeTz;

  // State
  const tripEndInstant = (() => {
    const lastDay = trip.days[trip.days.length - 1];
    return (
      parseIso(lastDay.releaseAt) ??
      ([...lastDay.legs].reverse().map((l) => parseIso(l.arrive)).find(Boolean) ?? null)
    );
  })();

  let state: ContextState;
  if (tripEndInstant && now >= tripEndInstant) state = 'trip-complete';
  else if (activeLayover) state = 'layover';
  else if (reportAt && releaseAt && now >= reportAt && now < releaseAt) state = 'on-duty';
  else if (reportAt && now >= reportAt) state = 'on-duty';
  else if (leaveHome && now >= new Date(leaveHome.getTime() - 90 * 60_000)) state = 'leave-soon';
  else if (reportAt && minutesBetween(now, reportAt)! <= PRE_TRIP_HORIZON_MIN) state = 'pre-trip';
  else state = 'pre-trip';

  return {
    ...base,
    state,
    dayIndex,
    day,
    currentLeg,
    nextLeg,
    minutesToNextLeg: nextLeg ? minutesBetween(now, nextLeg.depart) : null,
    reportAt,
    releaseAt,
    leaveHome,
    minutesToReport: reportAt ? minutesBetween(now, reportAt) : null,
    minutesToLeaveHome: leaveHome ? minutesBetween(now, leaveHome) : null,
    locationIcao,
    layover: activeLayover,
    nextLayover,
    partOfDay: partOfDayFor(now, locationTz),
  };
}

/** The headline CREW shows at the top of the home screen. */
export function greeting(ctx: PilotContext): string {
  switch (ctx.partOfDay) {
    case 'night':
      return 'Late one';
    case 'early':
      return 'Good morning';
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
  }
}

export type HomeCardKind =
  | 'leave-home'
  | 'report'
  | 'next-leg'
  | 'in-flight'
  | 'layover'
  | 'weather'
  | 'trip'
  | 'aircraft'
  | 'airport'
  | 'tomorrow'
  | 'sleep'
  | 'no-trip'
  | 'make-sense'
  | 'play';

/**
 * Ordered list of what the home screen should show, most urgent first.
 * The UI renders these; it does not decide them.
 */
export function homeCards(ctx: PilotContext): HomeCardKind[] {
  const cards: HomeCardKind[] = [];

  switch (ctx.state) {
    case 'no-trip':
      cards.push('no-trip', 'make-sense', 'weather', 'play');
      break;

    case 'pre-trip':
      cards.push('report');
      if (ctx.partOfDay === 'evening' || ctx.partOfDay === 'night') cards.push('sleep');
      cards.push('trip', 'weather', 'aircraft', 'airport');
      break;

    case 'leave-soon':
      cards.push('leave-home', 'report', 'weather', 'next-leg', 'trip');
      break;

    case 'on-duty':
      if (ctx.currentLeg) cards.push('in-flight', 'airport', 'weather', 'trip');
      else cards.push('next-leg', 'weather', 'airport', 'trip');
      if (ctx.nextLayover) cards.push('layover');
      break;

    case 'layover':
      cards.push('layover', 'weather', 'tomorrow', 'sleep', 'trip');
      break;

    case 'trip-complete':
      cards.push('trip', 'weather', 'make-sense', 'play');
      break;
  }

  return cards;
}
