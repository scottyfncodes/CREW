/**
 * The schedule layer: how a pilot's trips sort into current / upcoming /
 * past, which trip drives "Today" right now, and which flown legs are ready
 * to become logbook entries.
 *
 * This is what turns "a pile of trips" into "Schedule" and feeds "Today"
 * without either screen re-deriving the same rules.
 */

import type { DutyDay, FlightRecord, Leg, Trip } from '../types';
import { tripEnd, tripStart } from './trip';

// ---------------------------------------------------------------------------
// Building a schedule one flight at a time
// ---------------------------------------------------------------------------

/**
 * How many calendar days a new flight's date may sit outside a trip's
 * current day range and still count as "the same trip." Generous enough to
 * cover a rest day or two mid-pairing (the spec's own example has one), not
 * so generous that unrelated flights months apart accidentally merge.
 */
const SAME_TRIP_WINDOW_DAYS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKeyToTime = (key: string): number => new Date(`${key}T12:00:00Z`).getTime();

/**
 * How far a calendar date sits from a trip's day range, in days. Zero when
 * the date is already inside the range (or the range is empty).
 */
function distanceFromTripRange(trip: Trip, dateKey: string): number {
  if (trip.days.length === 0) return Infinity;
  const dates = trip.days.map((d) => d.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (dateKey >= first && dateKey <= last) return 0;
  const target = dateKeyToTime(dateKey);
  const before = (dateKeyToTime(first) - target) / DAY_MS;
  const after = (target - dateKeyToTime(last)) / DAY_MS;
  return Math.max(before, after, 0);
}

/** The best existing trip to extend with a flight on this date, if any. */
export function findTripForDate(trips: Trip[], dateKey: string): Trip | null {
  let best: { trip: Trip; distance: number } | null = null;
  for (const trip of trips) {
    const distance = distanceFromTripRange(trip, dateKey);
    if (distance > SAME_TRIP_WINDOW_DAYS) continue;
    if (!best || distance < best.distance) best = { trip, distance };
  }
  return best?.trip ?? null;
}

export interface NewLegInput {
  id: string;
  kind: Leg['kind'];
  flightNumber?: string | null;
  from: string;
  to: string;
  depart: string | null;
  arrive: string | null;
  aircraftId?: string | null;
  tail?: string | null;
  blockMinutes?: number | null;
}

/**
 * Fold one new flight into a trip list: append to the matching day of a
 * trip already close enough in time, create a new day inside that trip if
 * the date is a gap, or start a brand-new trip if nothing is close.
 *
 * Pure — returns the next `trips` array. The caller supplies fresh ids for
 * any new day so this stays independent of the app's id generator.
 */
export function appendFlightToTrips(
  trips: Trip[],
  dateKey: string,
  leg: NewLegInput,
  newDayId: string,
  newTripId: string,
): Trip[] {
  const target = findTripForDate(trips, dateKey);

  const sortLegs = (legs: Leg[]): Leg[] =>
    [...legs].sort((a, b) => {
      const at = a.depart ? new Date(a.depart).getTime() : Infinity;
      const bt = b.depart ? new Date(b.depart).getTime() : Infinity;
      return at - bt;
    });

  if (!target) {
    const trip: Trip = {
      id: newTripId,
      days: [{ id: newDayId, date: dateKey, reportAt: null, releaseAt: null, legs: [leg as Leg] }],
    };
    return [trip, ...trips];
  }

  return trips.map((trip) => {
    if (trip.id !== target.id) return trip;
    const existingDay = trip.days.find((d) => d.date === dateKey);
    if (existingDay) {
      return {
        ...trip,
        days: trip.days.map((d) =>
          d.id === existingDay.id ? { ...d, legs: sortLegs([...d.legs, leg as Leg]) } : d,
        ),
      };
    }
    const newDay: DutyDay = { id: newDayId, date: dateKey, reportAt: null, releaseAt: null, legs: [leg as Leg] };
    const days = [...trip.days, newDay].sort((a, b) => a.date.localeCompare(b.date));
    return { ...trip, days };
  });
}

export type TripPhase = 'current' | 'upcoming' | 'past';

/**
 * Where a trip sits relative to now.
 *
 * A trip with no derivable start/end (rare — only when a source gave no
 * times at all) is treated as upcoming rather than silently dropped, so it
 * still surfaces somewhere in Schedule.
 */
export function tripPhase(trip: Trip, now: Date): TripPhase {
  const start = tripStart(trip);
  const end = tripEnd(trip);
  if (end && end.getTime() <= now.getTime()) return 'past';
  if (start && start.getTime() <= now.getTime()) return 'current';
  return 'upcoming';
}

export interface ClassifiedTrips {
  current: Trip[];
  upcoming: Trip[];
  past: Trip[];
}

/** Every trip sorted into its phase. Upcoming is soonest-first, past is most-recent-first. */
export function classifyTrips(trips: Trip[], now: Date): ClassifiedTrips {
  const current: Trip[] = [];
  const upcoming: Trip[] = [];
  const past: Trip[] = [];
  for (const t of trips) {
    const phase = tripPhase(t, now);
    if (phase === 'current') current.push(t);
    else if (phase === 'upcoming') upcoming.push(t);
    else past.push(t);
  }
  const startTime = (t: Trip) => tripStart(t)?.getTime() ?? Infinity;
  upcoming.sort((a, b) => startTime(a) - startTime(b));
  past.sort((a, b) => startTime(b) - startTime(a));
  current.sort((a, b) => startTime(a) - startTime(b));
  return { current, upcoming, past };
}

/**
 * The one trip "Today" should be built from: the trip in progress right
 * now, or failing that the soonest upcoming trip. Null means genuinely
 * nothing scheduled — Today's empty state, not a bug.
 */
export function primaryTrip(trips: Trip[], now: Date): Trip | null {
  const { current, upcoming } = classifyTrips(trips, now);
  return current[0] ?? upcoming[0] ?? null;
}

// ---------------------------------------------------------------------------
// Schedule -> Logbook readiness
// ---------------------------------------------------------------------------

export interface PendingLeg {
  trip: Trip;
  day: DutyDay;
  leg: Leg;
}

/**
 * A flown leg counts as complete once it has landed. A pilot's own
 * "mark landed" overrides the clock in either direction: a status of
 * 'landed' counts even if the scheduled arrival hasn't technically passed
 * (early arrivals happen), and 'cancelled' is never complete regardless of
 * what the scheduled time says.
 */
export function legIsComplete(leg: Leg, now: Date): boolean {
  if (leg.kind !== 'flight') return false;
  if (leg.status === 'cancelled') return false;
  if (leg.status === 'landed') return true;
  const arrive = leg.actualArrive ?? leg.arrive;
  if (!arrive) return false;
  return new Date(arrive).getTime() <= now.getTime();
}

/** Has this leg already been turned into a logbook entry? */
export function legIsLogged(legId: string, flights: FlightRecord[]): boolean {
  return flights.some((f) => f.sourceLegId === legId);
}

/**
 * Every flown leg across every trip that has landed but has not yet been
 * confirmed into the logbook. Ordered oldest first, so "review this" always
 * means the flight that happened first.
 */
export function pendingLogbookLegs(trips: Trip[], flights: FlightRecord[], now: Date): PendingLeg[] {
  const out: PendingLeg[] = [];
  for (const trip of trips) {
    for (const day of trip.days) {
      for (const leg of day.legs) {
        if (!legIsComplete(leg, now)) continue;
        if (legIsLogged(leg.id, flights)) continue;
        out.push({ trip, day, leg });
      }
    }
  }
  out.sort((a, b) => {
    const at = a.leg.arrive ? new Date(a.leg.arrive).getTime() : 0;
    const bt = b.leg.arrive ? new Date(b.leg.arrive).getTime() : 0;
    return at - bt;
  });
  return out;
}

/** Just today's pending legs, for the home screen's end-of-day prompt. */
export function pendingLogbookLegsForDay(day: DutyDay, flights: FlightRecord[], now: Date): Leg[] {
  return day.legs.filter((leg) => legIsComplete(leg, now) && !legIsLogged(leg.id, flights));
}
