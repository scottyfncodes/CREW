import { beforeEach, describe, expect, it } from 'vitest';
import { restoreBackup, setAeroDataBoxKey } from './actions';
import { backupFilename, buildBackup, parseBackup } from './backup';
import { getState, setState } from './store';
import { STATE_VERSION } from './state';

beforeEach(() => {
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

describe('restoreBackup', () => {
  it('replaces the logbook but keeps this device’s key', () => {
    setAeroDataBoxKey('device-key');
    const backup = { app: 'crew', kind: 'backup', stateVersion: STATE_VERSION, state: { pilot: { name: 'Scott' }, flights: [] } };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    restoreBackup(parsed.state);
    const s = getState();
    expect(s.pilot.name).toBe('Scott');
    expect(s.pilot.prefs.use24h).toBe(true);
    expect(s.trips).toEqual([]);
    expect(s.flights).toEqual([]);
    expect(s.integrations.aeroDataBoxKey).toBe('device-key');
  });
});
