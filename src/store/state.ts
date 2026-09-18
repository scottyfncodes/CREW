/**
 * Application state and persistence.
 *
 * One store, one localStorage key, no framework. State is plain data so it
 * serialises cleanly and so the core logic can be tested without React.
 */

import type {
  Expense,
  FlightRecord,
  Pilot,
  Place,
  Tail,
  Trip,
} from '../core/types';

export type PlaceFeeling = 'saved' | 'visited' | 'not-interested';

export interface GameStats {
  played: number;
  correct: number;
  bestStreak: number;
  currentStreak: number;
}

export interface CrewState {
  version: number;
  pilot: Pilot;
  trips: Trip[];
  activeTripId: string | null;
  flights: FlightRecord[];
  tails: Tail[];
  expenses: Expense[];
  /** Per-place reactions that steer future layover recommendations. */
  placeFeelings: Record<string, PlaceFeeling>;
  games: Record<string, GameStats>;
  /** Set once the pilot has dismissed the sample-data banner. */
  sampleDismissed: boolean;
}

export const STATE_VERSION = 1;

export const DEFAULT_PILOT: Pilot = {
  name: '',
  airline: 'PSA Airlines',
  homeAirport: 'KDAY',
  baseAirport: 'KCLT',
  seat: 'FO',
  fleet: ['crj700', 'crj900'],
  pay: {
    hourlyRate: null,
    perDiemPerHour: null,
    minGuaranteeHours: null,
    currency: 'USD',
  },
  prefs: {
    commuteMinutes: 35,
    commuteMode: 'drive',
    airportBufferMinutes: 22,
    sleepTargetMinutes: 8 * 60,
    food: { cuisines: [], maxPrice: 3, coffeeMatters: true, wantsMichelin: true },
    activities: [],
    use24h: true,
  },
};

/** Places the pilot has reacted to, resolved back to guide entries. */
export function feelingFor(state: CrewState, place: Place): PlaceFeeling | null {
  return state.placeFeelings[place.id] ?? null;
}

export function activeTrip(state: CrewState): Trip | null {
  if (!state.activeTripId) return state.trips[0] ?? null;
  return state.trips.find((t) => t.id === state.activeTripId) ?? state.trips[0] ?? null;
}

export function tailFor(state: CrewState, registration: string | null | undefined): Tail | null {
  if (!registration) return null;
  const r = registration.toUpperCase();
  return state.tails.find((t) => t.registration.toUpperCase() === r) ?? null;
}
