/**
 * Application state and persistence.
 *
 * One store, one localStorage key, no framework. State is plain data so it
 * serialises cleanly and so the core logic can be tested without React.
 */

import type { Expense, FlightRecord, Pilot, Tail, Trip } from '../core/types';

export type PlaceFeeling = 'saved' | 'visited' | 'not-interested';

export interface GameStats {
  played: number;
  correct: number;
  bestStreak: number;
  currentStreak: number;
}

/** Optional third-party credentials the pilot supplies themselves. */
export interface Integrations {
  /**
   * RapidAPI key for AeroDataBox. Lets CREW look up any flight number on any
   * date. Stored only in this browser and sent only to AeroDataBox.
   */
  aeroDataBoxKey: string | null;
}

export interface CrewState {
  version: number;
  pilot: Pilot;
  integrations: Integrations;
  trips: Trip[];
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

export const DEFAULT_INTEGRATIONS: Integrations = { aeroDataBoxKey: null };

export const DEFAULT_PILOT: Pilot = {
  name: '',
  airline: 'PSA Airlines',
  airlineCode: 'OH',
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

