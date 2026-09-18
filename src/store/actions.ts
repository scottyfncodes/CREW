/** Every mutation in the app. Components call these, never setState directly. */

import type {
  Expense,
  FlightRecord,
  PayAssumptions,
  Pilot,
  Preferences,
  Tail,
  Trip,
} from '../core/types';
import { findAirport } from '../data/airportIndex';
import { dateKeyIn } from '../core/time/time';
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

export function addTrip(trip: Trip, makeActive = true): void {
  setState((s) => ({
    ...s,
    trips: [trip, ...s.trips.filter((t) => t.id !== trip.id)],
    activeTripId: makeActive ? trip.id : s.activeTripId,
  }));
}

export function setActiveTrip(tripId: string | null): void {
  setState((s) => ({ ...s, activeTripId: tripId }));
}

export function deleteTrip(tripId: string): void {
  setState((s) => {
    const trips = s.trips.filter((t) => t.id !== tripId);
    return { ...s, trips, activeTripId: s.activeTripId === tripId ? (trips[0]?.id ?? null) : s.activeTripId };
  });
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

export function logFlight(record: Omit<FlightRecord, 'id'>): void {
  setState((s) => {
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
 * Pull every completed leg of a trip into the logbook.
 * Deadheads are skipped — they are not flight time.
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
          (f) => f.date === date && f.from === leg.from && f.to === leg.to && !f.sample,
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
  setState((s) => ({ ...s, trips: [trip, ...s.trips], activeTripId: trip.id }));
}

export function restoreSampleData(): void {
  setState((s) => ({
    ...s,
    flights: [...buildSampleFlights(), ...s.flights.filter((f) => !f.sample)],
    tails: s.tails.length ? s.tails : buildSampleTails(),
    sampleDismissed: false,
  }));
}
