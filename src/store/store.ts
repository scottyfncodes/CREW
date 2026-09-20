/**
 * A tiny observable store on top of useSyncExternalStore.
 *
 * Deliberately not a state library: the app has one state tree, updates are
 * whole-object replacements, and persistence is a single write on change.
 */

import { useSyncExternalStore } from 'react';
import type { CrewState } from './state';
import { DEFAULT_INTEGRATIONS, DEFAULT_PILOT, STATE_VERSION } from './state';
import { buildSampleFlights, buildSampleTails, buildSampleTrip } from './seed';

const STORAGE_KEY = 'crew.state.v1';

function freshState(): CrewState {
  const trip = buildSampleTrip();
  return {
    version: STATE_VERSION,
    pilot: DEFAULT_PILOT,
    integrations: DEFAULT_INTEGRATIONS,
    trips: [trip],
    flights: buildSampleFlights(),
    tails: buildSampleTails(),
    expenses: [],
    placeFeelings: {},
    games: {},
    sampleDismissed: false,
  };
}

function load(): CrewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<CrewState>;
    if (parsed.version !== STATE_VERSION) return freshState();
    // Merge against defaults so a state written by an older build still boots.
    return {
      ...freshState(),
      ...parsed,
      pilot: { ...DEFAULT_PILOT, ...parsed.pilot, prefs: { ...DEFAULT_PILOT.prefs, ...parsed.pilot?.prefs }, pay: { ...DEFAULT_PILOT.pay, ...parsed.pilot?.pay } },
      integrations: { ...DEFAULT_INTEGRATIONS, ...parsed.integrations },
    } as CrewState;
  } catch {
    return freshState();
  }
}

let state: CrewState = typeof localStorage === 'undefined' ? freshState() : load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Out of quota or private mode — the session still works in memory.
  }
}

export function getState(): CrewState {
  return state;
}

export function setState(updater: (prev: CrewState) => CrewState): void {
  state = updater(state);
  persist();
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCrew(): CrewState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function clearEverything(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  setState(() => ({ ...freshState(), flights: [], tails: [], trips: [], sampleDismissed: true }));
}
