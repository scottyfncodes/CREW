/**
 * Backup and restore.
 *
 * Everything CREW knows lives in one browser's storage, so a pilot's logbook
 * is one cleared site-data tap away from gone. A backup is the whole state
 * tree in a small envelope, written to a file the pilot keeps. The
 * AeroDataBox key is left out on purpose: a backup file gets emailed and
 * AirDropped around, and a credential should not travel with it.
 */

import type { CrewState } from './state';
import { STATE_VERSION } from './state';

export const BACKUP_APP = 'crew';

export interface BackupEnvelope {
  app: typeof BACKUP_APP;
  kind: 'backup';
  stateVersion: number;
  exportedAt: string;
  state: Omit<CrewState, 'integrations'>;
}

export function buildBackup(state: CrewState, now: Date): BackupEnvelope {
  const { integrations: _omit, ...rest } = state;
  return { app: BACKUP_APP, kind: 'backup', stateVersion: STATE_VERSION, exportedAt: now.toISOString(), state: rest };
}

export function backupFilename(now: Date): string {
  return `crew-backup-${now.toISOString().slice(0, 10)}.json`;
}

export interface BackupSummary {
  exportedAt: string | null;
  trips: number;
  flights: number;
  tails: number;
  expenses: number;
}

export type ParsedBackup =
  | { ok: true; state: Omit<CrewState, 'integrations'>; summary: BackupSummary }
  | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read a backup file's text and say exactly what is wrong with it if it
 * cannot be restored. Nothing is merged here — restoring replaces the state,
 * so the check is strict about the shape of what it would replace it with.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP || raw.kind !== 'backup') {
    return { ok: false, error: 'That file is not a CREW backup.' };
  }
  if (raw.stateVersion !== STATE_VERSION) {
    return { ok: false, error: `This backup is format v${String(raw.stateVersion)}; this build of CREW reads v${STATE_VERSION}.` };
  }
  const s = raw.state;
  if (!isObject(s) || !isObject(s.pilot)) return { ok: false, error: 'The backup has no pilot profile.' };
  for (const key of ['trips', 'flights', 'tails', 'expenses'] as const) {
    if (s[key] !== undefined && !Array.isArray(s[key])) return { ok: false, error: `The backup's ${key} are damaged.` };
  }
  const flights = (s.flights ?? []) as unknown[];
  const bad = flights.findIndex(
    (f) =>
      !isObject(f) ||
      typeof f.date !== 'string' ||
      typeof f.from !== 'string' ||
      typeof f.to !== 'string' ||
      typeof f.blockMinutes !== 'number',
  );
  if (bad >= 0) return { ok: false, error: `Logbook entry ${bad + 1} in the backup is damaged.` };

  const state = { ...s, version: STATE_VERSION } as Omit<CrewState, 'integrations'>;
  return {
    ok: true,
    state,
    summary: {
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      trips: state.trips?.length ?? 0,
      flights: state.flights?.length ?? 0,
      tails: state.tails?.length ?? 0,
      expenses: state.expenses?.length ?? 0,
    },
  };
}
