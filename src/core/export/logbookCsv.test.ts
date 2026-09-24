import { describe, expect, it } from 'vitest';
import type { FlightRecord } from '../types';
import { csvCell, logbookCsv } from './logbookCsv';

const rec = (over: Partial<FlightRecord>): FlightRecord => ({
  id: 'f',
  date: '2026-09-18',
  from: 'DAY',
  to: 'CLT',
  aircraftId: 'crj700',
  blockMinutes: 81,
  seat: 'FO',
  ...over,
});

describe('csvCell', () => {
  it('quotes only what needs quoting', () => {
    expect(csvCell('KCLT')).toBe('KCLT');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('the "good" one')).toBe('"the ""good"" one"');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
  });
});

describe('logbookCsv', () => {
  it('writes oldest first, with ICAO codes and both block formats', () => {
    const csv = logbookCsv([rec({ id: 'b', date: '2026-09-19', blockMinutes: 605 }), rec({ id: 'a', tail: 'N705PS', note: 'Gusty, 25G38' })]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Date,From,To,Aircraft type,Aircraft,Tail,Seat,Block (h:mm),Block (hours),Note');
    expect(lines[1]).toBe('2026-09-18,KDAY,KCLT,CRJ7,CRJ700,N705PS,FO,1:21,1.35,"Gusty, 25G38"');
    expect(lines[2].startsWith('2026-09-19,')).toBe(true);
    expect(lines[2]).toContain(',10:05,10.08,');
  });

  it('leaves sample entries out of an export', () => {
    expect(logbookCsv([rec({ sample: true })]).trimEnd().split('\r\n')).toHaveLength(1);
  });
});
