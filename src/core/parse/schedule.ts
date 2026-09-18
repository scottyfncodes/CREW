/**
 * Pasted-schedule parser.
 *
 * Airline scheduling systems print trips in a dozen near-identical formats.
 * Rather than chase one, this parser is line-oriented and tolerant: it
 * classifies each line it recognises, ignores what it does not, and reports
 * both. Nothing is invented — a field the text does not contain comes out
 * null, and any date assumption is recorded so the UI can say so out loud.
 */

import { findAirport } from '../../data/airportIndex';
import type { DutyDay, Hotel, Leg, Trip } from '../types';
import { dateKeyIn, instantFromLocal, minutesBetween, shiftDateKey } from '../time/time';

export interface ParseIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  trip: Trip | null;
  /** Lines the parser understood. */
  recognizedLines: number;
  totalLines: number;
  issues: ParseIssue[];
  /** Anything the parser had to assume, stated plainly for the UI. */
  assumptions: string[];
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** "0615", "6:15", "06:15" -> "06:15". Returns null if it isn't a clock time. */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim().replace(/[^\d:]/g, '');
  let h: number;
  let m: number;
  if (s.includes(':')) {
    const [hs, ms] = s.split(':');
    h = Number(hs);
    m = Number(ms);
  } else if (s.length === 4) {
    h = Number(s.slice(0, 2));
    m = Number(s.slice(2));
  } else if (s.length === 3) {
    h = Number(s.slice(0, 1));
    m = Number(s.slice(1));
  } else {
    return null;
  }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h === 24 && m === 0) return '00:00';
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Pull a date out of a line in any of the formats crew systems print. */
export function parseDateToken(raw: string, defaultYear: number): string | null {
  const s = raw.trim().toUpperCase();

  // 2026-09-18
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // 18SEP26 / 18SEP2026 / 18SEP
  m = /^(\d{1,2})([A-Z]{3})(\d{2}|\d{4})?$/.exec(s);
  if (m && MONTHS[m[2]]) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
    return `${year}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // SEP18 / SEP 18
  m = /^([A-Z]{3})\s?(\d{1,2})$/.exec(s);
  if (m && MONTHS[m[1]]) {
    return `${defaultYear}-${String(MONTHS[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  // 09/18 or 09/18/26 or 09/18/2026
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(s);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : defaultYear;
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  return null;
}

function findDateInLine(line: string, defaultYear: number): string | null {
  const tokens = line.toUpperCase().match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[A-Z]{3}\d{0,4}|[A-Z]{3}\s?\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g);
  if (!tokens) return null;
  for (const t of tokens) {
    const d = parseDateToken(t, defaultYear);
    if (d) return d;
  }
  return null;
}

const DEADHEAD = /\b(DH|DHD|DDH|DEADHEAD)\b/i;
const REPORT_RE = /\b(?:RPT|REPORT|SHOW|CHECK\s?IN)\b\s*[:\-]?\s*(\d{1,2}:?\d{2})/i;
const RELEASE_RE = /\b(?:REL|RLS|RELEASE|DEBRIEF|BLOCK\s?IN)\b\s*[:\-]?\s*(\d{1,2}:?\d{2})/i;

interface RawLeg {
  flightNumber: string | null;
  from: string;
  to: string;
  depart: string; // HH:MM local at origin
  arrive: string; // HH:MM local at destination
  kind: 'flight' | 'deadhead';
  dateHint: string | null;
}

/**
 * Recognise a leg line. Requires two airport codes and two clock times in
 * order; anything else on the line is treated as noise.
 */
export function parseLegLine(line: string, defaultYear: number): RawLeg | null {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  // Airport codes: a 3- or 4-letter token that resolves against our dataset.
  const tokens = cleaned.split(/[\s|,>→-]+/).filter(Boolean);
  const codeIdx: number[] = [];
  tokens.forEach((t, i) => {
    const bare = t.replace(/[^A-Za-z]/g, '');
    if ((bare.length === 3 || bare.length === 4) && findAirport(bare)) codeIdx.push(i);
  });
  if (codeIdx.length < 2) return null;

  const from = tokens[codeIdx[0]].replace(/[^A-Za-z]/g, '').toUpperCase();
  const to = tokens[codeIdx[1]].replace(/[^A-Za-z]/g, '').toUpperCase();
  if (from === to) return null;

  // Times after the second airport code, falling back to anywhere on the line.
  const timeTokens: string[] = [];
  for (let i = codeIdx[1] + 1; i < tokens.length; i++) {
    const t = normalizeTime(tokens[i]);
    if (t && /^\d{1,2}:?\d{2}$/.test(tokens[i].replace(/[^\d:]/g, ''))) timeTokens.push(t);
  }
  if (timeTokens.length < 2) {
    for (const tk of tokens) {
      if (timeTokens.length >= 2) break;
      const t = normalizeTime(tk);
      if (t && /^\d{3,4}$|^\d{1,2}:\d{2}$/.test(tk.replace(/[^\d:]/g, ''))) timeTokens.push(t);
    }
  }
  if (timeTokens.length < 2) return null;

  // Flight number: a numeric token before the first airport code.
  let flightNumber: string | null = null;
  for (let i = 0; i < codeIdx[0]; i++) {
    const t = tokens[i].replace(/^(AA|OH|JIA|PSA|US)/i, '');
    if (/^\d{1,4}$/.test(t)) flightNumber = t;
  }

  return {
    flightNumber,
    from,
    to,
    depart: timeTokens[0],
    arrive: timeTokens[1],
    kind: DEADHEAD.test(cleaned) ? 'deadhead' : 'flight',
    dateHint: findDateInLine(cleaned, defaultYear),
  };
}

function matchLabelledTime(line: string, labels: RegExp): string | null {
  const m = labels.exec(line);
  if (!m) return null;
  return normalizeTime(m[1]);
}

let legSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(legSeq++).toString(36)}`;

export interface ParseOptions {
  /** Date to hang the trip on when the text carries none. Defaults to today. */
  anchorDate?: string;
  /** Timezone used to work out "today". Defaults to the device zone. */
  anchorTz?: string;
}

/**
 * Turn pasted schedule text into a Trip.
 *
 * The result is deliberately conservative: unknown stays unknown, and every
 * inference is either derived from an explicit value in the text or recorded
 * in `assumptions`.
 */
export function parseSchedule(text: string, options: ParseOptions = {}): ParseResult {
  const anchorTz = options.anchorTz ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const anchorDate = options.anchorDate ?? dateKeyIn(new Date(), anchorTz) ?? '1970-01-01';
  const defaultYear = Number(anchorDate.slice(0, 4));

  const lines = text.split(/\r?\n/);
  const issues: ParseIssue[] = [];
  const assumptions: string[] = [];
  let recognized = 0;

  let tripNumber: string | null = null;
  let creditMinutes: number | null = null;
  let perDiemRate: number | null = null;
  let sawAnyDate = false;

  type Pending = {
    date: string | null;
    reportTime: string | null;
    releaseTime: string | null;
    legs: RawLeg[];
    hotel: Hotel | null;
    notes: string[];
  };
  const days: Pending[] = [];
  const newDay = (): Pending => ({ date: null, reportTime: null, releaseTime: null, legs: [], hotel: null, notes: [] });
  let current: Pending | null = null;
  const ensureDay = () => {
    if (!current) {
      current = newDay();
      days.push(current);
    }
    return current;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // Trip / pairing number
    const trip = /\b(?:TRIP|PAIRING|SEQ(?:UENCE)?)\s*#?\s*[:\-]?\s*([A-Z]?\d{2,5})\b/i.exec(line);
    if (trip && !tripNumber) {
      tripNumber = trip[1].toUpperCase();
      recognized++;
    }

    // Published credit — recorded, never computed into this field.
    const credit = /\b(?:CREDIT|CRD|TAFB CREDIT)\s*[:\-]?\s*(\d{1,3})[:.](\d{2})\b/i.exec(line);
    if (credit && creditMinutes === null) {
      creditMinutes = Number(credit[1]) * 60 + Number(credit[2]);
      recognized++;
    }

    const perDiem = /\bPER\s?DIEM\s*[:\-]?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i.exec(line);
    if (perDiem && perDiemRate === null) {
      perDiemRate = Number(perDiem[1]);
      recognized++;
    }

    // A new duty day: an explicit day marker, or a date on its own line.
    const dayMarker = /^(?:DAY|D)\s*[:#]?\s*(\d)\b/i.exec(line);
    const lineDate = findDateInLine(line, defaultYear);
    const looksLikeLeg = parseLegLine(line, defaultYear) !== null;

    if (dayMarker && !looksLikeLeg) {
      current = newDay();
      days.push(current);
      if (lineDate) {
        current.date = lineDate;
        sawAnyDate = true;
      }
      // The day header usually carries the report time too: "D1 20SEP RPT 1340".
      const inlineReport = matchLabelledTime(line, REPORT_RE);
      if (inlineReport) current.reportTime = inlineReport;
      const inlineRelease = matchLabelledTime(line, RELEASE_RE);
      if (inlineRelease) current.releaseTime = inlineRelease;
      recognized++;
      continue;
    }

    // Report / release
    const report = matchLabelledTime(line, REPORT_RE);
    if (report) {
      const d = ensureDay();
      if (d.reportTime) {
        current = newDay();
        days.push(current);
      }
      ensureDay().reportTime = report;
      if (lineDate) {
        ensureDay().date = lineDate;
        sawAnyDate = true;
      }
      recognized++;
      continue;
    }

    const release = matchLabelledTime(line, RELEASE_RE);
    if (release) {
      ensureDay().releaseTime = release;
      recognized++;
      continue;
    }

    // Hotel
    if (/\b(?:HOTEL|HTL|LAYOVER HOTEL|RON)\b/i.test(line) && !looksLikeLeg) {
      const name = line
        .replace(/\b(?:LAYOVER\s+HOTEL|HOTEL|HTL|RON)\b\s*[:\-]?\s*/i, '')
        .replace(/^\s*(?:LAYOVER|OVERNIGHT)\b\s*[:\-]?\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      const phone = /(\+?\d[\d\-().\s]{8,}\d)/.exec(name);
      const d = ensureDay();
      d.hotel = {
        name: (phone ? name.replace(phone[1], '') : name).trim() || 'Hotel (name not given)',
        phone: phone ? phone[1].trim() : undefined,
      };
      recognized++;
      continue;
    }

    // Leg
    const leg = parseLegLine(line, defaultYear);
    if (leg) {
      const d = ensureDay();
      if (leg.dateHint) {
        sawAnyDate = true;
        if (!d.date) d.date = leg.dateHint;
      }
      d.legs.push(leg);
      recognized++;
      continue;
    }

    if (lineDate && !looksLikeLeg) {
      const d = ensureDay();
      if (d.legs.length > 0 || d.date) {
        current = newDay();
        days.push(current);
      }
      ensureDay().date = lineDate;
      sawAnyDate = true;
      recognized++;
      continue;
    }

    issues.push({ line: i + 1, text: line, reason: 'Not recognised as a leg, time, hotel or date' });
  }

  const usable = days.filter((d) => d.legs.length > 0 || d.reportTime || d.hotel);
  if (usable.length === 0) {
    return {
      trip: null,
      recognizedLines: recognized,
      totalLines: lines.filter((l) => l.trim()).length,
      issues,
      assumptions,
    };
  }

  if (!sawAnyDate) {
    assumptions.push(
      `No date appeared in the text. CREW anchored this trip to ${anchorDate} — change it if that is wrong.`,
    );
  }

  // Walk the days forward, filling dates and resolving local times to instants.
  let cursorDate = usable[0].date ?? anchorDate;
  const dutyDays: DutyDay[] = [];

  for (const pd of usable) {
    if (pd.date) cursorDate = pd.date;
    let dayDate = cursorDate;

    const legs: Leg[] = [];
    let lastArrival: Date | null = null;
    let legDate = dayDate;

    for (const rl of pd.legs) {
      const fromAp = findAirport(rl.from);
      const toAp = findAirport(rl.to);
      const fromTz = fromAp?.tz ?? anchorTz;
      const toTz = toAp?.tz ?? anchorTz;

      let dep = instantFromLocal(legDate, rl.depart, fromTz);
      // A departure before the previous arrival means the day rolled over.
      if (dep && lastArrival && dep.getTime() < lastArrival.getTime()) {
        legDate = shiftDateKey(legDate, 1);
        dep = instantFromLocal(legDate, rl.depart, fromTz);
      }

      let arr = dep ? instantFromLocal(legDate, rl.arrive, toTz) : null;
      // An arrival before its own departure means the leg crossed midnight.
      if (dep && arr && arr.getTime() < dep.getTime()) {
        arr = instantFromLocal(shiftDateKey(legDate, 1), rl.arrive, toTz);
      }

      legs.push({
        id: nextId('leg'),
        kind: rl.kind,
        flightNumber: rl.flightNumber,
        from: fromAp?.icao ?? rl.from,
        to: toAp?.icao ?? rl.to,
        depart: dep ? dep.toISOString() : null,
        arrive: arr ? arr.toISOString() : null,
        blockMinutes: dep && arr ? minutesBetween(dep, arr) : null,
      });

      if (arr) lastArrival = arr;
      if (!fromAp) issues.push({ line: 0, text: rl.from, reason: `Airport ${rl.from} is not in CREW's dataset` });
      if (!toAp) issues.push({ line: 0, text: rl.to, reason: `Airport ${rl.to} is not in CREW's dataset` });
    }

    // Report and release hang off the first departure / last arrival airport.
    const firstLeg = pd.legs[0];
    const reportTz = findAirport(firstLeg?.from)?.tz ?? anchorTz;
    const lastLeg = pd.legs[pd.legs.length - 1];
    const releaseTz = findAirport(lastLeg?.to)?.tz ?? anchorTz;

    const reportAt = pd.reportTime ? instantFromLocal(dayDate, pd.reportTime, reportTz) : null;
    let releaseAt = pd.releaseTime
      ? instantFromLocal(legDate, pd.releaseTime, releaseTz)
      : null;
    if (releaseAt && lastArrival && releaseAt.getTime() < lastArrival.getTime()) {
      releaseAt = instantFromLocal(shiftDateKey(legDate, 1), pd.releaseTime!, releaseTz);
    }

    dutyDays.push({
      id: nextId('day'),
      date: dayDate,
      reportAt: reportAt ? reportAt.toISOString() : null,
      releaseAt: releaseAt ? releaseAt.toISOString() : null,
      legs,
      hotel: pd.hotel,
      notes: pd.notes.length ? pd.notes.join(' ') : undefined,
    });

    // The next duty day starts no earlier than the day this one ended on.
    cursorDate = shiftDateKey(legDate, 1);
    dayDate = cursorDate;
  }

  return {
    trip: {
      id: nextId('trip'),
      number: tripNumber,
      days: dutyDays,
      creditMinutes,
      perDiemRate,
      rawSource: text,
    },
    recognizedLines: recognized,
    totalLines: lines.filter((l) => l.trim()).length,
    issues,
    assumptions,
  };
}
