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
    lastBackupAt: null,
  };
}

function load(): CrewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<CrewState>;
    if (parsed.version !== STATE_VERSION) return freshState();
    return hydrate(parsed);
  } catch {
    return freshState();
  }
}

/** Merge against defaults so a state written by an older build still boots. */
export function hydrate(parsed: Partial<CrewState>): CrewState {
  return {
    ...freshState(),
    ...parsed,
    pilot: { ...DEFAULT_PILOT, ...parsed.pilot, prefs: { ...DEFAULT_PILOT.prefs, ...parsed.pilot?.prefs }, pay: { ...DEFAULT_PILOT.pay, ...parsed.pilot?.pay } },
    integrations: { ...DEFAULT_INTEGRATIONS, ...parsed.integrations },
  } as CrewState;
}

let state: CrewState = typeof localStorage === 'undefined' ? freshState() : load();
const listeners = new Set<() => void>();

/**
 * Why the last write to this device failed, or null when it succeeded. The
 * session keeps working in memory either way, but the pilot has to be told:
 * an entry that only lives in memory is gone the next time iOS reclaims the
 * tab.
 */
let saveError: string | null = null;
let askedForPersistence = false;

function describeSaveError(err: unknown): string {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'This device is out of storage space for CREW, so your last change was not saved. Save a backup file now.';
  }
  return 'CREW could not save to this device, so your last change was not saved. Save a backup file now.';
}

function persist(): void {
  try {
    const text = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, text);
    // Reading it back is one string compare, and it is the only way to know
    // the write really landed.
    if (localStorage.getItem(STORAGE_KEY) !== text) throw new Error('read-back mismatch');
    saveError = null;
    if (!askedForPersistence) {
      askedForPersistence = true;
      requestPersistentStorage();
    }
  } catch (err) {
    saveError = describeSaveError(err);
  }
}

/** The last save failure, for the banner every screen shows. */
export function getSaveError(): string | null {
  return saveError;
}

export function useSaveError(): string | null {
  return useSyncExternalStore(subscribe, getSaveError, getSaveError);
}

/** What is actually stored on this device right now, or null if nothing readable is. */
export function readStoredText(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
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

/**
 * Ask the browser not to evict CREW's storage under pressure. Safari can
 * otherwise clear a site's data after a stretch without a visit, and this is
 * the only copy of a pilot's logbook. Best effort: a refusal changes nothing.
 */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* unsupported */
  }
}

/** True when the browser has agreed to keep CREW's data, null when it cannot say. */
export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
