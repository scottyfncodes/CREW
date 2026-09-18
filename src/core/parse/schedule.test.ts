import { describe, expect, it } from 'vitest';
import { normalizeTime, parseDateToken, parseLegLine, parseSchedule } from './schedule';
import { minutesBetween, timeIn } from '../time/time';

const OPTS = { anchorDate: '2026-09-18', anchorTz: 'America/New_York' };

describe('normalizeTime', () => {
  it('accepts the formats crew systems actually print', () => {
    expect(normalizeTime('0615')).toBe('06:15');
    expect(normalizeTime('6:15')).toBe('06:15');
    expect(normalizeTime('06:15')).toBe('06:15');
    expect(normalizeTime('615')).toBe('06:15');
    expect(normalizeTime('2359')).toBe('23:59');
  });

  it('treats 2400 as midnight', () => {
    expect(normalizeTime('2400')).toBe('00:00');
  });

  it('rejects impossible clock times instead of clamping them', () => {
    expect(normalizeTime('2515')).toBeNull();
    expect(normalizeTime('0673')).toBeNull();
    expect(normalizeTime('abc')).toBeNull();
    expect(normalizeTime('')).toBeNull();
  });
});

describe('parseDateToken', () => {
  it('reads every date shape crew systems use', () => {
    expect(parseDateToken('2026-09-18', 2026)).toBe('2026-09-18');
    expect(parseDateToken('18SEP', 2026)).toBe('2026-09-18');
    expect(parseDateToken('18SEP26', 2026)).toBe('2026-09-18');
    expect(parseDateToken('18SEP2026', 2026)).toBe('2026-09-18');
    expect(parseDateToken('SEP18', 2026)).toBe('2026-09-18');
    expect(parseDateToken('09/18', 2026)).toBe('2026-09-18');
    expect(parseDateToken('09/18/26', 2026)).toBe('2026-09-18');
  });

  it('returns null for things that are not dates', () => {
    expect(parseDateToken('0615', 2026)).toBeNull();
    expect(parseDateToken('CLT', 2026)).toBeNull();
  });
});

describe('parseLegLine', () => {
  it('reads a plain leg line', () => {
    const leg = parseLegLine('5142  DAY CLT  0600 0721', 2026);
    expect(leg).toMatchObject({ flightNumber: '5142', from: 'DAY', to: 'CLT', depart: '06:00', arrive: '07:21', kind: 'flight' });
  });

  it('reads ICAO codes and arrow separators', () => {
    const leg = parseLegLine('KCLT -> KDCA 0815 0932', 2026);
    expect(leg).toMatchObject({ from: 'KCLT', to: 'KDCA', depart: '08:15', arrive: '09:32' });
  });

  it('marks a deadhead', () => {
    const leg = parseLegLine('DH 1234 CLT DCA 0830 0945', 2026);
    expect(leg?.kind).toBe('deadhead');
  });

  it('strips an airline prefix from the flight number', () => {
    expect(parseLegLine('OH5142 DAY CLT 0600 0721', 2026)?.flightNumber).toBe('5142');
  });

  it('ignores a line with no airports', () => {
    expect(parseLegLine('CREW MEAL PROVIDED 1200', 2026)).toBeNull();
  });

  it('ignores a line with no times', () => {
    expect(parseLegLine('DAY CLT', 2026)).toBeNull();
  });

  it('ignores a same-airport line', () => {
    expect(parseLegLine('CLT CLT 0600 0700', 2026)).toBeNull();
  });
});

describe('parseSchedule', () => {
  const TWO_DAY = `TRIP 4412
DAY 1  18SEP
RPT 0515
5142  DAY CLT  0600 0721
5388  CLT DCA  0815 0932
5401  DCA CLT  1025 1156
REL 1211
HOTEL  Uptown Charlotte  704-555-0142

DAY 2  19SEP
RPT 0550
5217  CLT RIC  0635 0744
5230  RIC CLT  0830 0952
5119  CLT DAY  1105 1231
REL 1246`;

  it('builds the whole trip', () => {
    const r = parseSchedule(TWO_DAY, OPTS);
    expect(r.trip).not.toBeNull();
    expect(r.trip!.number).toBe('4412');
    expect(r.trip!.days).toHaveLength(2);
    expect(r.trip!.days[0].legs).toHaveLength(3);
    expect(r.trip!.days[1].legs).toHaveLength(3);
  });

  it('resolves codes to ICAO and times to real instants in the right zone', () => {
    const r = parseSchedule(TWO_DAY, OPTS);
    const leg = r.trip!.days[0].legs[0];
    expect(leg.from).toBe('KDAY');
    expect(leg.to).toBe('KCLT');
    expect(timeIn(leg.depart, 'America/New_York')).toBe('06:00');
    expect(timeIn(leg.arrive, 'America/New_York')).toBe('07:21');
    expect(leg.blockMinutes).toBe(81);
  });

  it('picks up report, release and the hotel', () => {
    const r = parseSchedule(TWO_DAY, OPTS);
    const d1 = r.trip!.days[0];
    expect(timeIn(d1.reportAt, 'America/New_York')).toBe('05:15');
    expect(timeIn(d1.releaseAt, 'America/New_York')).toBe('12:11');
    expect(d1.hotel?.name).toContain('Uptown Charlotte');
    expect(d1.hotel?.phone).toBe('704-555-0142');
  });

  it('puts the second duty day on the following date', () => {
    const r = parseSchedule(TWO_DAY, OPTS);
    expect(r.trip!.days[0].date).toBe('2026-09-18');
    expect(r.trip!.days[1].date).toBe('2026-09-19');
  });

  it('reports what it did not understand instead of silently dropping it', () => {
    const r = parseSchedule(`${TWO_DAY}\nSOME UNPARSEABLE COMPANY FOOTER`, OPTS);
    expect(r.issues.some((i) => i.text.includes('UNPARSEABLE'))).toBe(true);
    expect(r.recognizedLines).toBeGreaterThan(10);
  });

  it('says so when it had to assume a date', () => {
    const r = parseSchedule('5142 DAY CLT 0600 0721', OPTS);
    expect(r.assumptions).toHaveLength(1);
    expect(r.assumptions[0]).toContain('2026-09-18');
  });

  it('does not invent a report time that the text never gave', () => {
    const r = parseSchedule('5142 DAY CLT 0600 0721', OPTS);
    expect(r.trip!.days[0].reportAt).toBeNull();
    expect(r.trip!.days[0].releaseAt).toBeNull();
  });

  it('returns no trip at all rather than an empty one', () => {
    const r = parseSchedule('just some words with no schedule in them', OPTS);
    expect(r.trip).toBeNull();
  });

  it('handles a leg that crosses midnight', () => {
    const r = parseSchedule('DAY 1 18SEP\n5999 CLT DAY 2330 0045', OPTS);
    const leg = r.trip!.days[0].legs[0];
    expect(leg.blockMinutes).toBe(75);
    expect(new Date(leg.arrive!).getTime()).toBeGreaterThan(new Date(leg.depart!).getTime());
  });

  it('rolls the day when a later leg departs before the previous one arrived', () => {
    // Second leg shows 01:00, which must mean the next calendar day.
    const r = parseSchedule('DAY 1 18SEP\n1 CLT DCA 2200 2310\n2 DCA CLT 0100 0215', OPTS);
    const [a, b] = r.trip!.days[0].legs;
    expect(new Date(b.depart!).getTime()).toBeGreaterThan(new Date(a.arrive!).getTime());
    expect(b.blockMinutes).toBe(75);
  });

  it('accounts for the timezone change on a westbound leg', () => {
    // CLT (Eastern) 09:00 to ORD (Central) 09:50 is 110 minutes, not 50.
    const r = parseSchedule('DAY 1 18SEP\n1234 CLT ORD 0900 0950', OPTS);
    expect(r.trip!.days[0].legs[0].blockMinutes).toBe(110);
  });

  it('accounts for the timezone change on an eastbound leg', () => {
    // ORD (Central) 09:00 to CLT (Eastern) 12:00 is 120 minutes, not 180.
    const r = parseSchedule('DAY 1 18SEP\n1234 ORD CLT 0900 1200', OPTS);
    expect(r.trip!.days[0].legs[0].blockMinutes).toBe(120);
  });

  it('records a deadhead as a deadhead', () => {
    const r = parseSchedule('DAY 1 18SEP\nDH 1234 CLT DCA 0830 0945', OPTS);
    expect(r.trip!.days[0].legs[0].kind).toBe('deadhead');
  });

  it('reads published credit without computing it', () => {
    const r = parseSchedule(`CREDIT 12:45\n${TWO_DAY}`, OPTS);
    expect(r.trip!.creditMinutes).toBe(765);
  });

  it('keeps the source text for provenance', () => {
    const r = parseSchedule(TWO_DAY, OPTS);
    expect(r.trip!.rawSource).toBe(TWO_DAY);
  });

  it('survives a messy real-world paste', () => {
    const messy = `
      PAIRING: 8821          BASE CLT
      ------------------------------------
      D1 20SEP  RPT 1340
        OH 5561   CLT   AVL   1440   1533
        OH 5562   AVL   CLT   1610   1701
      RELEASE 1716
      LAYOVER HOTEL: THE DUNHILL  704-555-0199
      ------------------------------------
      D2 21SEP  RPT 0625
        OH 5104   CLT   SAV   0725   0836
        OH 5105   SAV   CLT   0915   1031
      RELEASE 1046
    `;
    const r = parseSchedule(messy, { anchorDate: '2026-09-20', anchorTz: 'America/New_York' });
    expect(r.trip!.number).toBe('8821');
    expect(r.trip!.days).toHaveLength(2);
    expect(r.trip!.days[0].legs).toHaveLength(2);
    expect(r.trip!.days[1].legs).toHaveLength(2);
    expect(timeIn(r.trip!.days[0].reportAt, 'America/New_York')).toBe('13:40');
    expect(r.trip!.days[0].hotel?.name).toContain('DUNHILL');
    // The overnight must come out positive and sane.
    const rel = r.trip!.days[0].releaseAt;
    const nextRpt = r.trip!.days[1].reportAt;
    expect(minutesBetween(rel, nextRpt)).toBeGreaterThan(600);
  });
});
