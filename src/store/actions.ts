/** Every mutation in the app. Components call these, never setState directly. */

import type {
  Expense,
  FlightRecord,
  Leg,
  PayAssumptions,
  Pilot,
  Preferences,
  Tail,
  Trip,
} from '../core/types';
import { findAirport } from '../data/airportIndex';
import { dateKeyIn } from '../core/time/time';
import { appendFlightToTrips, type NewLegInput } from '../core/context/schedule';
import { setState } from './store';
import type { GameStats, PlaceFeeling } from './state';
import { buildSampleFlights, buildSampleTails, buildSampleTrip } from './seed';

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function updatePilot(patch: Partial<Pilot>): void {
  setState((s) => ({ ...s, pilot: { ...s.pilot, ...patch } }));
}

export function updatePrefs(patch: Partial<Preferences>): void {
  setState((s) => ({ ...s, pilot: { ...s.pilot, prefs: { ...s.pilot.prefs, ...patch } } }));
}

export function updatePay(patch: Partial<PayAssumptions>): void {
  setState((s) => ({ ...s, pilot: { ...s.pilot, pay: { ...s.pilot.pay, ...patch } } }));
}

export function addTrip(trip: Trip): void {
  setState((s) => ({ ...s, trips: [trip, ...s.trips.filter((t) => t.id !== trip.id)] }));
}

export function deleteTrip(tripId: string): void {
  setState((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== tripId) }));
}

export function updateTrip(tripId: string, patch: Partial<Trip>): void {
  setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === tripId ? { ...t, ...patch } : t)) }));
}

/** Set (or clear) the hotel on one duty day. */
export function setHotel(tripId: string, dayId: string, hotel: Trip['days'][number]['hotel']): void {
  setState((s) => ({
    ...s,
    trips: s.trips.map((t) =>
      t.id === tripId ? { ...t, days: t.days.map((d) => (d.id === dayId ? { ...d, hotel } : d)) } : t,
    ),
  }));
}

/** Set (or clear) report/release for one duty day — the leave-home nudge needs a report time to work from. */
export function setDutyTimes(tripId: string, dayId: string, patch: { reportAt?: string | null; releaseAt?: string | null }): void {
  setState((s) => ({
    ...s,
    trips: s.trips.map((t) =>
      t.id === tripId ? { ...t, days: t.days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)) } : t,
    ),
  }));
}

/**
 * Fold one flight into the schedule: flight number and date in, a Leg out.
 * Finds the trip this flight belongs with (or starts a new one) and returns
 * the ids so the caller can navigate straight to it. This is the whole of
 * "Add to Schedule" — see core/context/schedule.ts for the matching rule.
 */
export function addFlightToSchedule(
  dateKey: string,
  leg: Omit<NewLegInput, 'id'>,
): { tripId: string; legId: string } {
  const legId = uid('leg');
  const newDayId = uid('day');
  let newTripId = '';
  let resolvedTripId = '';

  setState((s) => {
    newTripId = uid('trip');
    const before = new Set(s.trips.map((t) => t.id));
    const trips = appendFlightToTrips(s.trips, dateKey, { ...leg, id: legId }, newDayId, newTripId);
    resolvedTripId = trips.find((t) => !before.has(t.id))?.id ?? trips.find((t) => t.days.some((d) => d.legs.some((l) => l.id === legId)))!.id;
    return { ...s, trips };
  });

  return { tripId: resolvedTripId, legId };
}

/** Edit a leg already on the schedule — used for both corrections and status updates. */
export function updateLeg(tripId: string, dayId: string, legId: string, patch: Partial<Leg>): void {
  setState((s) => ({
    ...s,
    trips: s.trips.map((t) =>
      t.id !== tripId
        ? t
        : {
            ...t,
            days: t.days.map((d) =>
              d.id !== dayId ? d : { ...d, legs: d.legs.map((l) => (l.id === legId ? { ...l, ...patch } : l)) },
            ),
          },
    ),
  }));
}

/**
 * Remove a leg from the schedule. An emptied day is dropped too, and a
 * trip left with no days at all is removed — an add can always be undone.
 */
export function deleteLeg(tripId: string, dayId: string, legId: string): void {
  setState((s) => ({
    ...s,
    trips: s.trips
      .map((t) => {
        if (t.id !== tripId) return t;
        const days = t.days
          .map((d) => (d.id !== dayId ? d : { ...d, legs: d.legs.filter((l) => l.id !== legId) }))
          .filter((d) => d.legs.length > 0 || d.hotel);
        return { ...t, days };
      })
      .filter((t) => t.days.length > 0),
  }));
}

/** Move a leg earlier or later within its day — simple reordering, no drag-and-drop. */
export function moveLeg(tripId: string, dayId: string, legId: string, direction: 'up' | 'down'): void {
  setState((s) => ({
    ...s,
    trips: s.trips.map((t) => {
      if (t.id !== tripId) return t;
      return {
        ...t,
        days: t.days.map((d) => {
          if (d.id !== dayId) return d;
          const i = d.legs.findIndex((l) => l.id === legId);
          const j = direction === 'up' ? i - 1 : i + 1;
          if (i < 0 || j < 0 || j >= d.legs.length) return d;
          const legs = [...d.legs];
          [legs[i], legs[j]] = [legs[j], legs[i]];
          return { ...d, legs };
        }),
      };
    }),
  }));
}

export function logFlight(record: Omit<FlightRecord, 'id'>): void {
  setState((s) => {
    // A record tied to a schedule leg is never duplicated — re-submitting a
    // review screen (a double tap, a back-and-retry) is a no-op, not a
    // second logbook entry.
    if (record.sourceLegId && s.flights.some((f) => f.sourceLegId === record.sourceLegId)) return s;
    const flights = [{ ...record, id: uid('flt') }, ...s.flights];
    const tails = record.tail ? touchTail(s.tails, record.tail, record.aircraftId, record.date) : s.tails;
    return { ...s, flights, tails };
  });
}

function touchTail(tails: Tail[], registration: string, aircraftId: string, date: string): Tail[] {
  const reg = registration.toUpperCase();
  const existing = tails.find((t) => t.registration.toUpperCase() === reg);
  if (!existing) {
    return [...tails, { registration: reg, aircraftId, flightCount: 1, firstFlownByMe: date, lastFlownByMe: date }];
  }
  return tails.map((t) =>
    t.registration.toUpperCase() === reg
      ? {
          ...t,
          flightCount: t.flightCount + 1,
          firstFlownByMe: t.firstFlownByMe && t.firstFlownByMe < date ? t.firstFlownByMe : date,
          lastFlownByMe: t.lastFlownByMe && t.lastFlownByMe > date ? t.lastFlownByMe : date,
        }
      : t,
  );
}

export function deleteFlight(flightId: string): void {
  setState((s) => ({ ...s, flights: s.flights.filter((f) => f.id !== flightId) }));
}

/**
 * Pull every completed leg of a trip into the logbook in one go.
 * Deadheads are skipped — they are not flight time. A leg already logged
 * (by sourceLegId, or by the old date/route match for entries logged before
 * that field existed) is never re-added.
 */
export function logTripLegs(trip: Trip, seat: 'FO' | 'CA'): number {
  let added = 0;
  setState((s) => {
    let flights = s.flights;
    let tails = s.tails;
    for (const day of trip.days) {
      for (const leg of day.legs) {
        if (leg.kind !== 'flight') continue;
        if (!leg.depart || leg.blockMinutes === null || leg.blockMinutes === undefined) continue;
        const tz = findAirport(leg.from)?.tz ?? 'UTC';
        const date = dateKeyIn(leg.depart, tz) ?? day.date;
        const already = flights.some(
          (f) => f.sourceLegId === leg.id || (f.date === date && f.from === leg.from && f.to === leg.to && !f.sample),
        );
        if (already) continue;
        flights = [
          {
            id: uid('flt'),
            date,
            from: leg.from,
            to: leg.to,
            aircraftId: leg.aircraftId ?? 'crj700',
            tail: leg.tail ?? undefined,
            blockMinutes: leg.blockMinutes,
            seat,
            sourceLegId: leg.id,
          },
          ...flights,
        ];
        if (leg.tail) tails = touchTail(tails, leg.tail, leg.aircraftId ?? 'crj700', date);
        added++;
      }
    }
    return { ...s, flights, tails };
  });
  return added;
}

export function addExpense(expense: Omit<Expense, 'id'>): void {
  setState((s) => ({ ...s, expenses: [{ ...expense, id: uid('exp') }, ...s.expenses] }));
}

export function deleteExpense(expenseId: string): void {
  setState((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== expenseId) }));
}

/** ❤️ / ⭐ / 🚫 on a place. Tapping the same value again clears it. */
export function setPlaceFeeling(placeId: string, feeling: PlaceFeeling | null): void {
  setState((s) => {
    const next = { ...s.placeFeelings };
    if (feeling === null) delete next[placeId];
    else next[placeId] = feeling;
    return { ...s, placeFeelings: next };
  });
}

export function recordGameResult(gameId: string, correct: boolean): void {
  setState((s) => {
    const prev: GameStats = s.games[gameId] ?? { played: 0, correct: 0, bestStreak: 0, currentStreak: 0 };
    const currentStreak = correct ? prev.currentStreak + 1 : 0;
    return {
      ...s,
      games: {
        ...s.games,
        [gameId]: {
          played: prev.played + 1,
          correct: prev.correct + (correct ? 1 : 0),
          currentStreak,
          bestStreak: Math.max(prev.bestStreak, currentStreak),
        },
      },
    };
  });
}

/** Third-party key the pilot supplies. Never leaves this browser except to
 *  the provider it belongs to. */
export function setAeroDataBoxKey(key: string | null): void {
  setState((s) => ({ ...s, integrations: { ...s.integrations, aeroDataBoxKey: key } }));
}

export function clearSampleData(): void {
  setState((s) => ({
    ...s,
    flights: s.flights.filter((f) => !f.sample),
    sampleDismissed: true,
  }));
}

export function dismissSampleBanner(): void {
  setState((s) => ({ ...s, sampleDismissed: true }));
}

/** Regenerate the demo pairing against today, for when it has gone stale. */
export function refreshSampleTrip(): void {
  const trip = buildSampleTrip();
  setState((s) => ({ ...s, trips: [trip, ...s.trips] }));
}

export function restoreSampleData(): void {
  setState((s) => ({
    ...s,
    flights: [...buildSampleFlights(), ...s.flights.filter((f) => !f.sample)],
    tails: s.tails.length ? s.tails : buildSampleTails(),
    sampleDismissed: false,
  }));
}
