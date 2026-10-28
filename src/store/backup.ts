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
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optStr = (v: unknown) => v === undefined || v === null || isStr(v);
const optNum = (v: unknown) => v === undefined || v === null || isNum(v);

/** The keys a backup's state may carry. Anything else means a file this build does not understand. */
const STATE_KEYS = new Set([
  'version',
  'pilot',
  'trips',
  'flights',
  'tails',
  'expenses',
  'placeFeelings',
  'games',
  'sampleDismissed',
  'lastBackupAt',
]);
const SEATS = new Set(['FO', 'CA']);
const EXPENSE_CATEGORIES = new Set(['food', 'transport', 'hotel', 'supplies', 'other']);

const validFlight = (f: unknown) =>
  isObject(f) &&
  isStr(f.id) &&
  isStr(f.date) &&
  isStr(f.from) &&
  isStr(f.to) &&
  isStr(f.aircraftId) &&
  isNum(f.blockMinutes) &&
  SEATS.has(f.seat as string) &&
  optStr(f.tail) &&
  optStr(f.note) &&
  optStr(f.sourceLegId);

const validLeg = (l: unknown) =>
  isObject(l) && isStr(l.id) && isStr(l.kind) && isStr(l.from) && isStr(l.to) && optStr(l.depart) && optStr(l.arrive);

const validTrip = (t: unknown) =>
  isObject(t) &&
  isStr(t.id) &&
  Array.isArray(t.days) &&
  t.days.every((d) => isObject(d) && isStr(d.id) && isStr(d.date) && Array.isArray(d.legs) && d.legs.every(validLeg));

const validTail = (t: unknown) => isObject(t) && isStr(t.registration) && isStr(t.aircraftId) && isNum(t.flightCount);

const validExpense = (e: unknown) =>
  isObject(e) &&
  isStr(e.id) &&
  isStr(e.date) &&
  isNum(e.amount) &&
  isStr(e.currency) &&
  EXPENSE_CATEGORIES.has(e.category as string) &&
  typeof e.reimbursable === 'boolean';

/** Pilot fields may be missing (defaults fill them) but never the wrong type. */
function pilotProblem(p: Record<string, unknown>): string | null {
  for (const k of ['name', 'airline', 'homeAirport', 'baseAirport'] as const) {
    if (p[k] !== undefined && !isStr(p[k])) return `The backup's pilot ${k} is damaged.`;
  }
  if (!optStr(p.airlineCode)) return "The backup's airline code is damaged.";
  if (p.seat !== undefined && !SEATS.has(p.seat as string)) return "The backup's seat is damaged.";
  if (p.fleet !== undefined && !(Array.isArray(p.fleet) && p.fleet.every(isStr))) return "The backup's fleet is damaged.";
  if (p.pay !== undefined) {
    if (!isObject(p.pay)) return "The backup's pay assumptions are damaged.";
    for (const k of ['hourlyRate', 'perDiemPerHour', 'minGuaranteeHours'] as const) {
      if (!optNum(p.pay[k])) return "The backup's pay assumptions are damaged.";
    }
  }
  if (p.prefs !== undefined && !isObject(p.prefs)) return "The backup's preferences are damaged.";
  return null;
}

const LIST_CHECKS = [
  ['flights', validFlight, 'Logbook entry'],
  ['trips', validTrip, 'Trip'],
  ['tails', validTail, 'Tail'],
  ['expenses', validExpense, 'Expense'],
] as const;

/**
 * Read a backup file's text and say exactly what is wrong with it if it
 * cannot be restored. Nothing is merged here: restoring replaces the state,
 * so the check is strict about the shape of what it would replace it with,
 * and one bad record rejects the whole file rather than restoring part of it.
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
  if (!optStr(raw.exportedAt)) return { ok: false, error: "The backup's date is damaged." };
  const s = raw.state;
  if (!isObject(s) || !isObject(s.pilot)) return { ok: false, error: 'The backup has no pilot profile.' };
  const unknown = Object.keys(s).find((k) => !STATE_KEYS.has(k));
  if (unknown) return { ok: false, error: `The backup has a section this version of CREW does not know ("${unknown}").` };
  const pilotError = pilotProblem(s.pilot);
  if (pilotError) return { ok: false, error: pilotError };

  for (const [key, valid, label] of LIST_CHECKS) {
    if (s[key] === undefined) continue;
    const list = s[key];
    if (!Array.isArray(list)) return { ok: false, error: `The backup's ${key} are damaged.` };
    const bad = list.findIndex((item) => !valid(item));
    if (bad >= 0) return { ok: false, error: `${label} ${bad + 1} in the backup is damaged.` };
  }
  for (const key of ['placeFeelings', 'games'] as const) {
    if (s[key] !== undefined && !isObject(s[key])) return { ok: false, error: `The backup's ${key} are damaged.` };
  }
  if (s.sampleDismissed !== undefined && typeof s.sampleDismissed !== 'boolean') {
    return { ok: false, error: 'The backup is damaged.' };
  }
  if (!optStr(s.lastBackupAt)) return { ok: false, error: 'The backup is damaged.' };

  const state = { ...s, version: STATE_VERSION } as Omit<CrewState, 'integrations'>;
  return {
    ok: true,
    state,
    summary: {
      exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : null,
      trips: state.trips?.length ?? 0,
      flights: state.flights?.length ?? 0,
      tails: state.tails?.length ?? 0,
      expenses: state.expenses?.length ?? 0,
    },
  };
}
