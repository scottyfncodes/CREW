/**
 * The logbook as CSV — the one format every logbook app, spreadsheet and
 * airline recordkeeping form can take in. Oldest first, the way a paper
 * logbook reads.
 */

import { aircraftLabel, findAircraft } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import type { FlightRecord } from '../types';
import { formatHoursDecimal } from '../time/time';

const HEADER = ['Date', 'From', 'To', 'Aircraft type', 'Aircraft', 'Tail', 'Seat', 'Block (h:mm)', 'Block (hours)', 'Note'];

/** RFC 4180 quoting: wrap when needed, double any embedded quote. */
export function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const hmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes % 60)).padStart(2, '0')}`;

export function logbookCsv(flights: FlightRecord[]): string {
  const rows = [...flights]
    .filter((f) => !f.sample)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => {
      const spec = findAircraft(f.aircraftId);
      return [
        f.date,
        findAirport(f.from)?.icao ?? f.from,
        findAirport(f.to)?.icao ?? f.to,
        spec?.icaoType ?? '',
        spec ? aircraftLabel(f.aircraftId) : f.aircraftId,
        f.tail ?? '',
        f.seat,
        hmm(f.blockMinutes),
        formatHoursDecimal(f.blockMinutes, 2),
        f.note ?? '',
      ];
    });
  return [HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
