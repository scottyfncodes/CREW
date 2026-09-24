import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findAirline, parseFlightNumber, toCallsign, toIataFlightNumber } from '../data/airlines';
import {
  aircraftIdFromIcaoType,
  aircraftIdFromModel,
  lookupFlight,
  lookupFromHistory,
  parseAdbTime,
  statusFromAdb,
} from './flightLookup';
import { parseSchedule } from '../core/parse/schedule';
import { timeIn } from '../core/time/time';
import type { Trip } from '../core/types';
import { DEFAULT_INTEGRATIONS, DEFAULT_PILOT, type CrewState } from '../store/state';
import { clearCache } from './fetcher';

/** A localStorage stand-in, since these tests run outside a browser. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
}

function fakeState(overrides: Partial<CrewState> = {}): CrewState {
  return {
    version: 1,
    pilot: DEFAULT_PILOT,
    integrations: DEFAULT_INTEGRATIONS,
    trips: [],
    flights: [],
    tails: [],
    expenses: [],
    placeFeelings: {},
    games: {},
    sampleDismissed: true,
    lastBackupAt: null,
    ...overrides,
  };
}

describe('parseFlightNumber', () => {
  it('reads a bare number', () => {
    expect(parseFlightNumber('5142')).toEqual({ prefix: null, airline: null, number: '5142' });
  });

  it('reads an IATA prefix and resolves the airline', () => {
    const p = parseFlightNumber('OH5142')!;
    expect(p.number).toBe('5142');
    expect(p.airline?.name).toBe('PSA Airlines');
  });

  it('reads an ICAO prefix', () => {
    expect(parseFlightNumber('JIA5142')?.airline?.iata).toBe('OH');
  });

  it('tolerates spacing and lower case', () => {
    expect(parseFlightNumber('aa 1234')?.airline?.icao).toBe('AAL');
  });

  it('keeps an unknown prefix without inventing an airline', () => {
    const p = parseFlightNumber('ZZ999')!;
    expect(p.prefix).toBe('ZZ');
    expect(p.airline).toBeNull();
    expect(p.number).toBe('999');
  });

  it('does not mistake leading digits for a carrier code', () => {
    expect(parseFlightNumber('95142')?.number).toBe('95142');
    expect(parseFlightNumber('95142')?.airline).toBeNull();
  });

  it('rejects input with no number in it', () => {
    expect(parseFlightNumber('')).toBeNull();
    expect(parseFlightNumber('AA')).toBeNull();
    expect(parseFlightNumber('not a flight')).toBeNull();
  });
});

describe('callsign and flight-number formatting', () => {
  const psa = findAirline('OH')!;

  it('builds the ADS-B callsign', () => {
    expect(toCallsign('5142', psa)).toBe('JIA5142');
    expect(toCallsign('1234', findAirline('AA'))).toBe('AAL1234');
  });

  it('builds the IATA flight number a schedule API wants', () => {
    expect(toIataFlightNumber('5142', psa)).toBe('OH5142');
  });

  it('returns null rather than guessing when the airline is unknown', () => {
    expect(toCallsign('5142', null)).toBeNull();
    expect(toIataFlightNumber('5142', null)).toBeNull();
  });
});

describe('aircraft identification', () => {
  it('maps ADS-B type codes onto CREW aircraft', () => {
    expect(aircraftIdFromIcaoType('CRJ7')).toBe('crj700');
    expect(aircraftIdFromIcaoType('crj9')).toBe('crj900');
    expect(aircraftIdFromIcaoType('B738')).toBe('b738');
    expect(aircraftIdFromIcaoType('A388')).toBeNull();
    expect(aircraftIdFromIcaoType(null)).toBeNull();
  });

  it('maps free-text models onto CREW aircraft', () => {
    expect(aircraftIdFromModel('Canadair CRJ-900')).toBe('crj900');
    expect(aircraftIdFromModel('Bombardier CRJ 700')).toBe('crj700');
    expect(aircraftIdFromModel('Embraer 175')).toBe('e175');
    expect(aircraftIdFromModel('Boeing 737-800')).toBe('b738');
    expect(aircraftIdFromModel('Airbus A220-300')).toBe('a220-300');
    expect(aircraftIdFromModel('Cessna 172')).toBeNull();
    expect(aircraftIdFromModel(undefined)).toBeNull();
  });
});

describe('parseAdbTime', () => {
  it('reads the space-separated UTC form the API returns', () => {
    expect(parseAdbTime('2026-09-18 10:00Z')).toBe('2026-09-18T10:00:00.000Z');
  });

  it('returns null for missing or unparseable values', () => {
    expect(parseAdbTime(undefined)).toBeNull();
    expect(parseAdbTime('not a time')).toBeNull();
  });
});

describe('lookupFromHistory', () => {
  const trips: Trip[] = [
    parseSchedule(
      `DAY 1 18SEP\n5142 DAY CLT 0600 0721\n5388 CLT DCA 0815 0932`,
      { anchorDate: '2026-09-18', anchorTz: 'America/New_York' },
    ).trip!,
  ];

  it('finds a flight the pilot has flown and returns its route', () => {
    const r = lookupFromHistory('5142', '2026-10-05', trips);
    expect(r.from).toBe('KDAY');
    expect(r.to).toBe('KCLT');
  });

  it('re-hangs the wall-clock times on the requested date', () => {
    const r = lookupFromHistory('5142', '2026-10-05', trips);
    expect(timeIn(r.depart!, 'America/New_York')).toBe('06:00');
    expect(timeIn(r.arrive!, 'America/New_York')).toBe('07:21');
    expect(r.depart!.slice(0, 10)).toBe('2026-10-05');
    expect(r.blockMinutes).toBe(81);
  });

  it('says out loud that the times are a memory, not a schedule', () => {
    const r = lookupFromHistory('5142', '2026-10-05', trips);
    expect(r.notes.join(' ')).toMatch(/retimed|history/i);
    expect(r.notes.join(' ')).toContain('2026-09-18');
  });

  it('returns nothing for a flight number never flown', () => {
    const r = lookupFromHistory('9999', '2026-10-05', trips);
    expect(r.from).toBeUndefined();
    expect(r.notes).toHaveLength(0);
  });

  it('picks the most recent occurrence when there are several', () => {
    const older = parseSchedule('DAY 1 01SEP\n5142 CLT DAY 1400 1520', {
      anchorDate: '2026-09-01',
      anchorTz: 'America/New_York',
    }).trip!;
    // Older trip listed first; the later one must still win.
    const r = lookupFromHistory('5142', '2026-10-05', [older, ...trips]);
    expect(r.from).toBe('KDAY');
    expect(r.to).toBe('KCLT');
  });

  it('carries a midnight crossing forward onto the new date', () => {
    const lateTrip = parseSchedule('DAY 1 18SEP\n5999 CLT DAY 2330 0045', {
      anchorDate: '2026-09-18',
      anchorTz: 'America/New_York',
    }).trip!;
    const r = lookupFromHistory('5999', '2026-10-05', [lateTrip]);
    expect(new Date(r.arrive!).getTime()).toBeGreaterThan(new Date(r.depart!).getTime());
    expect(r.blockMinutes).toBe(75);
  });

  it('preserves a timezone-crossing block time', () => {
    const tzTrip = parseSchedule('DAY 1 18SEP\n1234 CLT ORD 0900 0950', {
      anchorDate: '2026-09-18',
      anchorTz: 'America/New_York',
    }).trip!;
    const r = lookupFromHistory('1234', '2026-10-05', [tzTrip]);
    expect(r.blockMinutes).toBe(110);
  });
});

describe('statusFromAdb', () => {
  it('maps AeroDataBox vocabulary onto the small CREW status set', () => {
    expect(statusFromAdb('Landed')).toBe('landed');
    expect(statusFromAdb('EnRoute')).toBe('enroute');
    expect(statusFromAdb('Departed')).toBe('enroute');
    expect(statusFromAdb('Canceled')).toBe('cancelled');
    expect(statusFromAdb('Expected')).toBe('scheduled');
  });

  it('returns null for anything unfamiliar rather than guessing', () => {
    expect(statusFromAdb('SomeNewApiValue')).toBeNull();
    expect(statusFromAdb(undefined)).toBeNull();
    expect(statusFromAdb('')).toBeNull();
  });
});

describe('lookupFlight (the full chain)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves from history alone when the flight is not airborne and no key is set', async () => {
    const trip = parseSchedule('DAY 1 18SEP\n5142 DAY CLT 0600 0721', {
      anchorDate: '2026-09-18',
      anchorTz: 'America/New_York',
    }).trip!;
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    const r = await lookupFlight('5142', '2026-10-05', fakeState({ trips: [trip] }), { today: '2026-10-01' });
    expect(r?.from).toBe('KDAY');
    expect(r?.origin.from).toBe('history');
    expect(r?.notes.join(' ')).toMatch(/retimed/i);
  });

  it('says plainly when nothing is found anywhere', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    const r = await lookupFlight('9999', '2026-10-05', fakeState(), { today: '2026-10-01' });
    expect(r).not.toBeNull();
    expect(r!.from).toBeNull();
    expect(r!.to).toBeNull();
    expect(Object.keys(r!.origin)).toHaveLength(0);
    expect(r!.notes.join(' ')).toMatch(/not seen this flight number/i);
  });

  it('resolves nothing rather than throwing when every network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const r = await lookupFlight('9999', '2026-10-05', fakeState({ integrations: { aeroDataBoxKey: 'k' } }), {
      today: '2026-10-01',
    });
    expect(r).not.toBeNull();
    expect(r!.notes.join(' ')).toContain('AeroDataBox');
  });

  it('returns null only for input that is not a flight number at all', async () => {
    const r = await lookupFlight('not a flight number', '2026-10-05', fakeState());
    expect(r).toBeNull();
  });

  it('lets a schedule-sourced field outrank the same field from history', async () => {
    const trip = parseSchedule('DAY 1 18SEP\n5142 DAY CLT 0600 0721', {
      anchorDate: '2026-09-18',
      anchorTz: 'America/New_York',
    }).trip!;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('aerodatabox')) {
          return new Response(
            JSON.stringify([
              {
                departure: { airport: { icao: 'KDAY' }, scheduledTime: { utc: '2026-10-05 06:30Z' } },
                arrival: { airport: { icao: 'KCLT' }, scheduledTime: { utc: '2026-10-05 07:50Z' } },
                aircraft: { model: 'Bombardier CRJ 900', reg: 'N999PS' },
                status: 'Scheduled',
              },
            ]),
            { status: 200 },
          );
        }
        throw new Error('not airborne');
      }),
    );
    const r = await lookupFlight('5142', '2026-10-05', fakeState({ trips: [trip], integrations: { aeroDataBoxKey: 'k' } }), {
      today: '2026-10-01',
    });
    expect(r?.origin.depart).toBe('schedule');
    expect(r?.tail).toBe('N999PS');
    expect(r?.aircraftId).toBe('crj900');
  });
});
