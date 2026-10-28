import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addExpense, logFlight, refreshSampleTrip, restoreBackup, restoreSampleData, setAeroDataBoxKey } from './actions';
import { backupFilename, buildBackup, parseBackup } from './backup';
import { getSaveError, getState, readStoredText, setState } from './store';
import { STATE_VERSION } from './state';

/** A working localStorage, so saves and read-backs behave as in a browser. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setState((s) => ({ ...s, trips: [], flights: [], tails: [], expenses: [] }));
  setAeroDataBoxKey(null);
});

const now = new Date('2026-09-24T12:00:00Z');

describe('buildBackup', () => {
  it('never carries the AeroDataBox key', () => {
    setAeroDataBoxKey('secret-key');
    const text = JSON.stringify(buildBackup(getState(), now));
    expect(text).not.toContain('secret-key');
    expect(text).not.toContain('integrations');
  });

  it('names the file by date', () => {
    expect(backupFilename(now)).toBe('crew-backup-2026-09-24.json');
  });
});

describe('backup file shape', () => {
  it('is a versioned envelope around all user data', () => {
    const backup = buildBackup(getState(), now);
    expect(backup).toMatchObject({ app: 'crew', kind: 'backup', stateVersion: STATE_VERSION, exportedAt: now.toISOString() });
    expect(Object.keys(backup.state).sort()).toEqual(
      ['expenses', 'flights', 'games', 'lastBackupAt', 'pilot', 'placeFeelings', 'sampleDismissed', 'tails', 'trips', 'version'],
    );
  });
});

describe('parseBackup', () => {
  it('round-trips a backup it wrote', () => {
    setState((s) => ({
      ...s,
      flights: [{ id: 'f1', date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO' }],
    }));
    const parsed = parseBackup(JSON.stringify(buildBackup(getState(), now)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.flights).toBe(1);
    expect(parsed.summary.exportedAt).toBe(now.toISOString());
  });

  it('explains what is wrong instead of restoring garbage', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'That file is not valid JSON.' });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, error: 'That file is not a CREW backup.' });
    expect(parseBackup(JSON.stringify({ app: 'crew', kind: 'backup', stateVersion: 99, state: {} }))).toMatchObject({
      ok: false,
    });
    const damaged = { app: 'crew', kind: 'backup', stateVersion: STATE_VERSION, state: { pilot: {}, flights: [{ date: 1 }] } };
    expect(parseBackup(JSON.stringify(damaged))).toEqual({ ok: false, error: 'Logbook entry 1 in the backup is damaged.' });
  });
});

describe('parseBackup is strict', () => {
  const good = () => JSON.parse(JSON.stringify(buildBackup(getState(), now)));

  it('accepts a backup it wrote', () => {
    expect(parseBackup(JSON.stringify(good())).ok).toBe(true);
  });

  it('rejects a wrong version, a missing version and a different app', () => {
    expect(parseBackup(JSON.stringify({ ...good(), stateVersion: 2 }))).toMatchObject({ ok: false });
    const { stateVersion: _v, ...noVersion } = good();
    expect(parseBackup(JSON.stringify(noVersion))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ ...good(), app: 'route-rabbit' }))).toMatchObject({ ok: false });
  });

  it('rejects a file where only some records are sound, rather than restoring part of it', () => {
    const b = good();
    b.state.flights = [
      { id: 'a', date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO' },
      { id: 'b', date: '2026-09-18', from: 'KCLT', to: 'KDAY', aircraftId: 'crj700', blockMinutes: '81', seat: 'FO' },
    ];
    expect(parseBackup(JSON.stringify(b))).toEqual({ ok: false, error: 'Logbook entry 2 in the backup is damaged.' });
  });

  it('rejects damaged trips, tails, expenses and pilot fields', () => {
    const trips = good();
    trips.state.trips = [{ id: 't', days: [{ id: 'd', date: '2026-09-18', legs: [{ id: 'l' }] }] }];
    expect(parseBackup(JSON.stringify(trips))).toEqual({ ok: false, error: 'Trip 1 in the backup is damaged.' });
    const tails = good();
    tails.state.tails = [{ registration: 'N705PS' }];
    expect(parseBackup(JSON.stringify(tails))).toEqual({ ok: false, error: 'Tail 1 in the backup is damaged.' });
    const expenses = good();
    expenses.state.expenses = [{ id: 'e', date: '2026-09-18', amount: 12, currency: 'USD', category: 'snacks', reimbursable: false }];
    expect(parseBackup(JSON.stringify(expenses))).toEqual({ ok: false, error: 'Expense 1 in the backup is damaged.' });
    const pilot = good();
    pilot.state.pilot.seat = 'Jumpseat';
    expect(parseBackup(JSON.stringify(pilot))).toMatchObject({ ok: false });
  });

  it('rejects sections it does not know', () => {
    const b = good();
    b.state.integrations = { aeroDataBoxKey: 'smuggled' };
    expect(parseBackup(JSON.stringify(b))).toMatchObject({ ok: false });
  });
});

describe('round trip', () => {
  it('restores exactly what was backed up, and the device holds it', () => {
    logFlight({ date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO' });
    refreshSampleTrip();
    restoreSampleData();
    addExpense({ date: '2026-09-18', amount: 14.5, currency: 'USD', category: 'food', reimbursable: false });
    const before = getState();
    const text = JSON.stringify(buildBackup(before, now));
    setState((s) => ({ ...s, flights: [], trips: [] }));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(restoreBackup(parsed.state)).toEqual({ ok: true });
    const { integrations: _a, ...after } = getState();
    const { integrations: _b, ...expected } = before;
    expect(after).toEqual(expected);
    expect(readStoredText()).toBe(JSON.stringify(getState()));
  });
});

describe('save failures are visible', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a full device instead of failing silently', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    vi.stubGlobal('localStorage', storage);
    setState((s) => ({ ...s, sampleDismissed: true }));
    expect(getSaveError()).toMatch(/out of storage space/);
  });

  it('clears the warning once a save works again', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    setState((s) => ({ ...s, sampleDismissed: true }));
    expect(getSaveError()).toBeNull();
  });

  it('does not claim a restore that the device could not hold, and changes nothing', () => {
    logFlight({ date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO' });
    const before = getState();
    const parsed = parseBackup(
      JSON.stringify({ app: 'crew', kind: 'backup', stateVersion: STATE_VERSION, state: { pilot: {}, flights: [] } }),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    vi.stubGlobal('localStorage', storage);
    expect(restoreBackup(parsed.state)).toMatchObject({ ok: false });
    expect(getState()).toEqual(before);
  });
});

describe('restoreBackup', () => {
  it('replaces the logbook but keeps this device’s key', () => {
    setAeroDataBoxKey('device-key');
    const backup = { app: 'crew', kind: 'backup', stateVersion: STATE_VERSION, state: { pilot: { name: 'Scott' }, flights: [] } };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(restoreBackup(parsed.state)).toEqual({ ok: true });
    const s = getState();
    expect(s.pilot.name).toBe('Scott');
    expect(s.pilot.prefs.use24h).toBe(true);
    expect(s.trips).toEqual([]);
    expect(s.flights).toEqual([]);
    expect(s.integrations.aeroDataBoxKey).toBe('device-key');
  });
});
