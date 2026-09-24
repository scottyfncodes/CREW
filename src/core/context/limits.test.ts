import { describe, expect, it } from 'vitest';
import { parseSchedule } from '../parse/schedule';
import type { DutyDay, FlightRecord, Trip } from '../types';
import {
  LIMIT_28_DAY_MIN,
  cumulativeLimits,
  dutyFlightTime,
  flightTimeSamples,
  limitTone,
  windowMinutes,
} from './limits';

const build = (text: string, anchorDate: string): Trip =>
  parseSchedule(text, { anchorDate, anchorTz: 'America/New_York' }).trip!;

// 1:21 + 1:17 on day 1, 1:26 on day 2 (a deadhead would not count).
const trip = build(
  `DAY 1 18SEP\nRPT 0515\n5142 DAY CLT 0600 0721\n5388 CLT DCA 0815 0932\nREL 1000\n\nDAY 2 19SEP\nRPT 0550\n5119 CLT DAY 1105 1231\nREL 1246`,
  '2026-09-18',
);

const rec = (date: string, blockMinutes: number, sourceLegId?: string): FlightRecord => ({
  id: `f-${date}-${blockMinutes}`,
  date,
  from: 'KCLT',
  to: 'KDAY',
  aircraftId: 'crj700',
  blockMinutes,
  seat: 'FO',
  sourceLegId,
});

describe('flightTimeSamples', () => {
  it('counts scheduled legs on the date they depart, local to the departure airport', () => {
    const s = flightTimeSamples([], [trip]);
    expect(s.map((x) => x.date)).toEqual(['2026-09-18', '2026-09-18', '2026-09-19']);
    expect(s.every((x) => x.source === 'schedule')).toBe(true);
  });

  it('never counts a leg twice once it has been logged', () => {
    const firstLeg = trip.days[0].legs[0];
    const s = flightTimeSamples([rec('2026-09-18', 81, firstLeg.id)], [trip]);
    expect(s).toHaveLength(3);
    expect(s.filter((x) => x.source === 'logbook')).toHaveLength(1);
  });

  it('skips deadheads and cancelled legs', () => {
    const t: Trip = structuredClone(trip);
    t.days[0].legs[0].kind = 'deadhead';
    t.days[0].legs[1].status = 'cancelled';
    expect(flightTimeSamples([], [t])).toHaveLength(1);
  });
});

describe('windowMinutes', () => {
  const samples = [
    { date: '2026-08-22', minutes: 60, source: 'logbook' as const },
    { date: '2026-08-23', minutes: 60, source: 'logbook' as const },
    { date: '2026-09-19', minutes: 30, source: 'logbook' as const },
  ];

  it('is inclusive of both ends of an N-day window', () => {
    // 28 days ending 19 Sep starts 23 Aug.
    expect(windowMinutes(samples, '2026-09-19', 28)).toBe(90);
    expect(windowMinutes(samples, '2026-09-18', 28)).toBe(120);
  });
});

describe('cumulativeLimits', () => {
  it('projects the peak forward across the schedule', () => {
    const summary = cumulativeLimits([rec('2026-09-01', 600)], [trip], '2026-09-17');
    const d28 = summary.limits[0];
    expect(d28.limitMinutes).toBe(LIMIT_28_DAY_MIN);
    expect(d28.todayMinutes).toBe(600);
    expect(d28.peak.date).toBe('2026-09-19');
    expect(d28.peak.minutes).toBe(600 + 81 + 77 + 86);
    expect(summary.includesSchedule).toBe(true);
  });

  it('reports today as the peak when nothing is scheduled', () => {
    const summary = cumulativeLimits([rec('2026-09-01', 600)], [], '2026-09-17');
    expect(summary.limits[0].peak).toEqual({ date: '2026-09-17', minutes: 600 });
    expect(summary.includesSchedule).toBe(false);
  });
});

describe('limitTone', () => {
  it('warns only above the limit and cautions within 10% of it', () => {
    expect(limitTone(80 * 60, 100 * 60)).toBe('go');
    expect(limitTone(90 * 60, 100 * 60)).toBe('caution');
    expect(limitTone(100 * 60, 100 * 60)).toBe('caution');
    expect(limitTone(100 * 60 + 1, 100 * 60)).toBe('warn');
  });
});

describe('dutyFlightTime', () => {
  it('allows 9 hours for a duty starting in the day', () => {
    const d = dutyFlightTime(trip.days[0]);
    expect(d.startHour).toBe(5);
    expect(d.limitMinutes).toBe(9 * 60);
    expect(d.flightMinutes).toBe(81 + 77);
  });

  it('allows 8 hours for a duty starting before 05:00 local', () => {
    const early = build('DAY 1 18SEP\nRPT 0430\n5142 DAY CLT 0515 0636\nREL 0700', '2026-09-18');
    expect(dutyFlightTime(early.days[0]).limitMinutes).toBe(8 * 60);
  });

  it('allows 8 hours for a duty starting at 20:00 or later', () => {
    const late = build('DAY 1 18SEP\nRPT 2000\n5142 DAY CLT 2045 2206\nREL 2230', '2026-09-18');
    expect(dutyFlightTime(late.days[0]).limitMinutes).toBe(8 * 60);
  });

  it('leaves the limit unknown when the duty has no start time', () => {
    const day: DutyDay = {
      id: 'd',
      date: '2026-09-18',
      reportAt: null,
      releaseAt: null,
      legs: [{ id: 'l', kind: 'flight', from: 'KDAY', to: 'KCLT', depart: null, arrive: null }],
    };
    expect(dutyFlightTime(day)).toEqual({ flightMinutes: null, limitMinutes: null, startHour: null });
  });
});
