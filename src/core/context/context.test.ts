import { describe, expect, it } from 'vitest';
import { buildContext, homeCards, partOfDayFor } from './engine';
import {
  activeDayIndex,
  dayDutyMinutes,
  dayFlightMinutes,
  leaveHomeAt,
  routeLine,
  timeAwayMinutes,
  tripFlightMinutes,
  tripLayovers,
} from './trip';
import { applyGuarantee, tripEarnings } from './pay';
import { buildLayoverPlan, layoverBudget, scorePlace } from './layover';
import { airportVisits, fleetFromLog, logbookTotals } from './stats';
import { parseSchedule } from '../parse/schedule';
import { DEFAULT_PILOT } from '../../store/state';
import type { FlightRecord, Pilot, Place, Trip } from '../types';
import { guideByKey } from '../../data/layovers';

const OPTS = { anchorDate: '2026-09-18', anchorTz: 'America/New_York' };

const TRIP_TEXT = `TRIP 4412
DAY 1  18SEP
RPT 0515
5142  DAY CLT  0600 0721
5388  CLT DCA  0815 0932
5401  DCA CLT  1025 1156
REL 1211
HOTEL  Uptown Charlotte

DAY 2  19SEP
RPT 0550
5217  CLT RIC  0635 0744
5119  CLT DAY  1105 1231
REL 1246`;

const trip: Trip = parseSchedule(TRIP_TEXT, OPTS).trip!;
const pilot: Pilot = { ...DEFAULT_PILOT, homeAirport: 'KDAY', baseAirport: 'KCLT' };

describe('trip derivations', () => {
  it('sums flight time across a duty day', () => {
    // 81 + 77 + 91 minutes.
    expect(dayFlightMinutes(trip.days[0])).toBe(249);
  });

  it('sums flight time across the whole trip', () => {
    expect(tripFlightMinutes(trip)).toBe(249 + 69 + 86);
  });

  it('uses published report and release for duty when they exist', () => {
    const duty = dayDutyMinutes(trip.days[0]);
    expect(duty.basis).toBe('published');
    expect(duty.minutes).toBe(416); // 05:15 -> 12:11
  });

  it('falls back to block-to-block and says so when they do not', () => {
    const noTimes = parseSchedule('DAY 1 18SEP\n1 DAY CLT 0600 0721', OPTS).trip!;
    const duty = dayDutyMinutes(noTimes.days[0]);
    expect(duty.basis).toBe('derived');
    expect(duty.minutes).toBe(81);
  });

  it('reports unknown duty as unknown', () => {
    const empty: Trip = { id: 'x', days: [{ id: 'd', date: '2026-09-18', reportAt: null, releaseAt: null, legs: [] }] };
    expect(dayDutyMinutes(empty.days[0])).toEqual({ minutes: null, basis: 'unknown' });
  });

  it('measures time away from base across the whole trip', () => {
    // 18 Sep 05:15 to 19 Sep 12:46.
    expect(timeAwayMinutes(trip)).toBe(31 * 60 + 31);
  });

  it('renders the route without repeating connecting airports', () => {
    expect(routeLine(trip.days[0])).toBe('DAY → CLT → DCA → CLT');
  });

  it('finds the overnight between duty days', () => {
    const layovers = tripLayovers(trip);
    expect(layovers).toHaveLength(1);
    expect(layovers[0].airport).toBe('KCLT');
    expect(layovers[0].city).toBe('Charlotte');
    // 12:11 to 05:50 the next morning.
    expect(layovers[0].minutes).toBe(17 * 60 + 39);
  });

  it('works out when to leave home from the pilot own settings', () => {
    const prefs = { ...pilot.prefs, commuteMinutes: 35, airportBufferMinutes: 22 };
    const leave = leaveHomeAt(trip.days[0].reportAt, prefs);
    // 05:15 minus 57 minutes.
    expect(leave?.toISOString()).toBe('2026-09-18T08:18:00.000Z'); // 04:18 EDT
  });

  it('returns no leave time when there is no report time', () => {
    expect(leaveHomeAt(null, pilot.prefs)).toBeNull();
  });
});

describe('activeDayIndex', () => {
  it('stays on day one during day one', () => {
    expect(activeDayIndex(trip, new Date('2026-09-18T14:00:00Z'))).toBe(0);
  });

  it('moves to day two once day one has released', () => {
    expect(activeDayIndex(trip, new Date('2026-09-18T20:00:00Z'))).toBe(1);
  });
});

describe('partOfDayFor', () => {
  const at = (iso: string) => partOfDayFor(new Date(iso), 'America/New_York');
  it('classifies the pilot day', () => {
    expect(at('2026-09-18T06:00:00Z')).toBe('night'); // 02:00
    expect(at('2026-09-18T07:00:00Z')).toBe('early'); // 03:00 — an 0515 show
    expect(at('2026-09-18T10:00:00Z')).toBe('early'); // 06:00
    expect(at('2026-09-18T14:00:00Z')).toBe('morning'); // 10:00
    expect(at('2026-09-18T18:00:00Z')).toBe('afternoon'); // 14:00
    expect(at('2026-09-18T23:00:00Z')).toBe('evening'); // 19:00
    expect(at('2026-09-19T03:00:00Z')).toBe('night'); // 23:00
  });
});

describe('context engine', () => {
  const ctx = (iso: string) => buildContext(pilot, trip, new Date(iso));

  it('knows there is no trip', () => {
    const c = buildContext(pilot, null, new Date('2026-09-18T12:00:00Z'));
    expect(c.state).toBe('no-trip');
    expect(homeCards(c)).toContain('add-flight');
  });

  it('is pre-trip well before report', () => {
    const c = ctx('2026-09-17T20:00:00Z'); // 16:00 the day before
    expect(c.state).toBe('pre-trip');
    expect(homeCards(c)[0]).toBe('report');
  });

  it('shows the sleep card the evening before report, not evenings earlier', () => {
    // 21:00 EDT the night before an 05:15 report.
    expect(homeCards(ctx('2026-09-18T01:00:00Z'))).toContain('sleep');
    // 21:00 EDT three nights before.
    expect(homeCards(ctx('2026-09-16T01:00:00Z'))).not.toContain('sleep');
  });

  it('switches to leave-soon inside the commute window', () => {
    // Report 09:15Z; leave home 08:18Z; window opens 06:48Z.
    const c = ctx('2026-09-18T07:30:00Z');
    expect(c.state).toBe('leave-soon');
    expect(homeCards(c)[0]).toBe('leave-home');
    expect(c.leaveHome?.toISOString()).toBe('2026-09-18T08:18:00.000Z');
  });

  it('is on duty after report', () => {
    const c = ctx('2026-09-18T12:00:00Z');
    expect(c.state).toBe('on-duty');
  });

  it('knows which leg is airborne', () => {
    // 5388 CLT->DCA runs 12:15Z to 13:32Z.
    const c = ctx('2026-09-18T13:00:00Z');
    expect(c.currentLeg?.flightNumber).toBe('5388');
    expect(c.locationIcao).toBe('KDCA');
    expect(homeCards(c)[0]).toBe('in-flight');
  });

  it('knows the next leg when on the ground between flights', () => {
    const c = ctx('2026-09-18T11:40:00Z'); // after 5142 lands, before 5388
    expect(c.nextLeg?.flightNumber).toBe('5388');
    expect(c.minutesToNextLeg).toBe(35);
  });

  it('recognises the layover and puts it first', () => {
    const c = ctx('2026-09-18T22:00:00Z'); // 18:00 EDT, released, hotel in CLT
    expect(c.state).toBe('layover');
    expect(c.layover?.city).toBe('Charlotte');
    expect(c.locationIcao).toBe('KCLT');
    expect(homeCards(c)[0]).toBe('layover');
  });

  it('surfaces day-one legs still unlogged during the day-one/day-two layover, not just "today"', () => {
    // Regression: unloggedLegs was once scoped to ctx.day, which during this
    // layover resolves to day two (not yet flown) — silently hiding the
    // three day-one legs that had, in fact, just landed.
    const c = ctx('2026-09-18T22:00:00Z');
    expect(c.state).toBe('layover');
    expect(c.day).toBe(trip.days[1]);
    expect(c.unloggedLegs.map((p) => p.leg.flightNumber)).toEqual(['5142', '5388', '5401']);
    expect(homeCards(c)).toContain('review-logbook');
  });

  it('marks the trip complete after the last release', () => {
    const c = ctx('2026-09-19T20:00:00Z');
    expect(c.state).toBe('trip-complete');
  });

  it('never returns a card list the UI cannot render', () => {
    const known = new Set([
      'leave-home', 'report', 'next-leg', 'in-flight', 'layover', 'weather',
      'trip', 'aircraft', 'airport', 'tomorrow', 'sleep', 'no-trip', 'add-flight',
      'review-logbook', 'play',
    ]);
    for (const iso of [
      '2026-09-17T20:00:00Z', '2026-09-18T07:30:00Z', '2026-09-18T13:00:00Z',
      '2026-09-18T22:00:00Z', '2026-09-19T20:00:00Z',
    ]) {
      for (const card of homeCards(ctx(iso))) expect(known.has(card)).toBe(true);
    }
  });
});

describe('pay', () => {
  it('reports what is missing rather than guessing a rate', () => {
    const e = tripEarnings(trip, { hourlyRate: null, perDiemPerHour: null, minGuaranteeHours: null, currency: 'USD' });
    expect(e.flightPay).toBeNull();
    expect(e.total).toBeNull();
    expect(e.missing).toEqual(['hourly rate', 'per diem rate']);
  });

  it('computes from the pilot own numbers and shows the basis', () => {
    const e = tripEarnings(trip, { hourlyRate: 100, perDiemPerHour: 2.5, minGuaranteeHours: null, currency: 'USD' });
    expect(e.basis).toBe('block-time');
    expect(e.paidMinutes).toBe(404);
    expect(e.flightPay).toBeCloseTo(673.33, 2);
    // TAFB 31h31m at 2.50.
    expect(e.perDiem).toBeCloseTo(78.79, 2);
    expect(e.total).toBeCloseTo(752.12, 2);
    expect(e.effectiveHourly).toBeCloseTo(23.86, 1);
  });

  it('prefers published credit over computed block time', () => {
    const withCredit: Trip = { ...trip, creditMinutes: 480 };
    const e = tripEarnings(withCredit, { hourlyRate: 100, perDiemPerHour: null, minGuaranteeHours: null, currency: 'USD' });
    expect(e.basis).toBe('published-credit');
    expect(e.flightPay).toBe(800);
  });

  it('applies a monthly guarantee only when it helps', () => {
    const pay = { hourlyRate: 100, perDiemPerHour: null, minGuaranteeHours: 75, currency: 'USD' };
    expect(applyGuarantee(60 * 60, pay)).toEqual({ paidMinutes: 75 * 60, guaranteeApplied: true });
    expect(applyGuarantee(90 * 60, pay)).toEqual({ paidMinutes: 90 * 60, guaranteeApplied: false });
    expect(applyGuarantee(60 * 60, { ...pay, minGuaranteeHours: null }).guaranteeApplied).toBe(false);
  });
});

describe('layover engine', () => {
  const prefs = DEFAULT_PILOT.prefs;

  it('holds back sleep and transit on a long overnight', () => {
    const b = layoverBudget(18 * 60, prefs, 20);
    expect(b.sleepMinutes).toBe(8 * 60);
    expect(b.transitMinutes).toBe(40);
    expect(b.usableMinutes).toBe(18 * 60 - 8 * 60 - 40);
  });

  it('scales sleep down rather than pretending a short sit is a night', () => {
    const b = layoverBudget(5 * 60, prefs, 20);
    expect(b.sleepMinutes).toBeLessThan(8 * 60);
    expect(b.usableMinutes).toBeGreaterThan(0);
  });

  it('never returns negative usable time', () => {
    expect(layoverBudget(30, prefs, 40).usableMinutes).toBe(0);
  });

  it('ranks a dinner restaurant up at dinner time and down at breakfast', () => {
    const guide = guideByKey('dca')!;
    const dinner = guide.places.find((p) => p.category === 'restaurant')!;
    const base = { usableMinutes: 300, prefs, feelings: {} };
    const evening = scorePlace(dinner, { ...base, hour: 19 });
    const morning = scorePlace(dinner, { ...base, hour: 7 });
    expect(evening.score).toBeGreaterThan(morning.score);
    expect(evening.reasons).toContain("It's dinner time");
  });

  it('pushes outdoor options down when the weather is against it', () => {
    const guide = guideByKey('clt')!;
    const outdoor = guide.places.find((p) => p.tags?.includes('outdoors'))!;
    const base = { hour: 14, usableMinutes: 300, prefs, feelings: {} };
    expect(scorePlace(outdoor, { ...base, wetOutside: true }).score).toBeLessThan(
      scorePlace(outdoor, { ...base, wetOutside: false }).score,
    );
  });

  it('respects a not-interested mark', () => {
    const guide = guideByKey('clt')!;
    const p = guide.places[0];
    const base = { hour: 19, usableMinutes: 300, prefs };
    const normal = scorePlace(p, { ...base, feelings: {} });
    const rejected = scorePlace(p, { ...base, feelings: { [p.id]: 'not-interested' as const } });
    expect(rejected.score).toBeLessThan(normal.score - 100);
  });

  it('boosts a saved place', () => {
    const guide = guideByKey('clt')!;
    const p = guide.places[0];
    const base = { hour: 19, usableMinutes: 300, prefs };
    expect(scorePlace(p, { ...base, feelings: { [p.id]: 'saved' as const } }).score).toBeGreaterThan(
      scorePlace(p, { ...base, feelings: {} }).score,
    );
  });

  it('marks things that do not fit the time available', () => {
    const long: Place = {
      id: 'x', name: 'Long thing', category: 'museum', city: 'Charlotte', why: 'Long.',
      dwellMinutes: 300, links: [], michelin: null, hours: null,
    };
    expect(scorePlace(long, { hour: 12, usableMinutes: 60, prefs, feelings: {} }).fits).toBe(false);
  });

  it('builds an itinerary that fits inside the usable time', () => {
    const guide = guideByKey('clt')!;
    const budget = layoverBudget(10 * 60, prefs, 20);
    const plan = buildLayoverPlan(guide, budget, { hour: 17, prefs, feelings: {} });
    expect(plan.itinerary.length).toBeGreaterThan(0);
    const total = plan.itinerary.reduce((n, i) => n + i.place.dwellMinutes, 0);
    expect(total).toBeLessThanOrEqual(budget.usableMinutes);
    // No two stops of the same kind.
    const cats = plan.itinerary.map((i) => i.place.category);
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('returns a short, varied shortlist rather than the whole guide', () => {
    const guide = guideByKey('dca')!;
    const plan = buildLayoverPlan(guide, layoverBudget(8 * 60, prefs, 20), { hour: 18, prefs, feelings: {} });
    expect(plan.picks.length).toBeLessThanOrEqual(6);
    expect(plan.picks.length).toBeLessThan(guide.places.length);
  });

  it('says plainly when there is no guide instead of inventing one', () => {
    const plan = buildLayoverPlan(null, layoverBudget(6 * 60, prefs, 20), { hour: 18, prefs, feelings: {} });
    expect(plan.picks).toHaveLength(0);
    expect(plan.note).toContain('no curated guide');
  });

  it('tells the pilot to rest when there is genuinely no time', () => {
    const plan = buildLayoverPlan(guideByKey('clt'), layoverBudget(60, prefs, 40), { hour: 2, prefs, feelings: {} });
    expect(plan.budget.usableMinutes).toBe(0);
    expect(plan.note).toContain('Rest');
  });
});

describe('statistics', () => {
  const flights: FlightRecord[] = [
    { id: '1', date: '2026-08-01', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', tail: 'N705PS', blockMinutes: 81, seat: 'FO' },
    { id: '2', date: '2026-08-01', from: 'KCLT', to: 'KDCA', aircraftId: 'crj700', tail: 'N705PS', blockMinutes: 77, seat: 'FO' },
    { id: '3', date: '2026-09-02', from: 'KCLT', to: 'KPHL', aircraftId: 'crj900', tail: 'N713PS', blockMinutes: 96, seat: 'FO' },
  ];

  it('counts every airport touched, in both directions', () => {
    const v = airportVisits(flights);
    expect(v.find((x) => x.icao === 'KCLT')?.visits).toBe(3);
    expect(v.find((x) => x.icao === 'KDAY')?.visits).toBe(1);
    expect(v).toHaveLength(4);
  });

  it('tracks first and last dates per airport', () => {
    const clt = airportVisits(flights).find((x) => x.icao === 'KCLT')!;
    expect(clt.first).toBe('2026-08-01');
    expect(clt.last).toBe('2026-09-02');
  });

  it('builds the fleet from tail numbers', () => {
    const fleet = fleetFromLog(flights, []);
    expect(fleet).toHaveLength(2);
    expect(fleet[0].tail).toBe('N705PS');
    expect(fleet[0].flights).toBe(2);
    expect(fleet[0].blockMinutes).toBe(158);
  });

  it('totals the logbook and finds the longest leg', () => {
    const t = logbookTotals(flights, []);
    expect(t.flights).toBe(3);
    expect(t.blockMinutes).toBe(254);
    expect(t.types).toBe(2);
    expect(t.distanceNm).toBeGreaterThan(0);
    expect(t.longestLeg).not.toBeNull();
    expect(t.busiestMonth?.month).toBe('2026-08');
  });

  it('handles an empty logbook without blowing up', () => {
    const t = logbookTotals([], []);
    expect(t.flights).toBe(0);
    expect(t.longestLeg).toBeNull();
    expect(t.busiestMonth).toBeNull();
  });
});
