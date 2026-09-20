import { describe, expect, it } from 'vitest';
import { parseSchedule } from '../parse/schedule';
import type { FlightRecord, Leg, Trip } from '../types';
import {
  appendFlightToTrips,
  classifyTrips,
  findTripForDate,
  legIsComplete,
  legIsLogged,
  pendingLogbookLegs,
  pendingLogbookLegsForDay,
  primaryTrip,
  tripPhase,
  type NewLegInput,
} from './schedule';

const build = (text: string, anchorDate: string): Trip =>
  parseSchedule(text, { anchorDate, anchorTz: 'America/New_York' }).trip!;

// A two-day trip anchored to 18-19 Sep 2026.
const septTrip = build(
  `DAY 1 18SEP\nRPT 0515\n5142 DAY CLT 0600 0721\n5388 CLT DCA 0815 0932\nREL 1000\n\nDAY 2 19SEP\nRPT 0550\n5119 CLT DAY 1105 1231\nREL 1246`,
  '2026-09-18',
);

// A single-day trip well in the future.
const octTrip = build('DAY 1 10OCT\nRPT 0900\n1234 CLT DAY 0900 1021\nREL 1036', '2026-10-10');

// A single-day trip well in the past.
const augTrip = build('DAY 1 01AUG\nRPT 0900\n9999 DAY CLT 0900 1021\nREL 1036', '2026-08-01');

describe('tripPhase', () => {
  it('is upcoming before the trip starts', () => {
    expect(tripPhase(septTrip, new Date('2026-09-17T00:00:00Z'))).toBe('upcoming');
  });

  it('is current between start and end', () => {
    expect(tripPhase(septTrip, new Date('2026-09-18T12:00:00Z'))).toBe('current');
  });

  it('is past once the last release has happened', () => {
    expect(tripPhase(septTrip, new Date('2026-09-20T00:00:00Z'))).toBe('past');
  });

  it('treats a trip with no derivable timing as upcoming, never past', () => {
    const empty: Trip = { id: 'x', days: [{ id: 'd', date: '2026-09-18', reportAt: null, releaseAt: null, legs: [] }] };
    expect(tripPhase(empty, new Date('2099-01-01T00:00:00Z'))).toBe('upcoming');
  });
});

describe('classifyTrips', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  const all = [augTrip, octTrip, septTrip];

  it('sorts every trip into exactly one bucket', () => {
    const c = classifyTrips(all, now);
    expect(c.current.map((t) => t.id)).toEqual([septTrip.id]);
    expect(c.upcoming.map((t) => t.id)).toEqual([octTrip.id]);
    expect(c.past.map((t) => t.id)).toEqual([augTrip.id]);
  });

  it('orders upcoming soonest-first and past most-recent-first', () => {
    const nextOct = build('DAY 1 20OCT\nRPT 0900\n1 CLT DAY 0900 1021\nREL 1036', '2026-10-20');
    const c = classifyTrips([nextOct, octTrip], now);
    expect(c.upcoming.map((t) => t.id)).toEqual([octTrip.id, nextOct.id]);
  });
});

describe('primaryTrip', () => {
  it('picks the trip in progress over anything upcoming', () => {
    const now = new Date('2026-09-18T12:00:00Z');
    expect(primaryTrip([octTrip, septTrip], now)?.id).toBe(septTrip.id);
  });

  it('falls back to the soonest upcoming trip when nothing is current', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    expect(primaryTrip([octTrip, septTrip], now)?.id).toBe(septTrip.id);
  });

  it('is null with no trips at all — the genuine empty state', () => {
    expect(primaryTrip([], new Date())).toBeNull();
  });

  it('is null when every trip is in the past', () => {
    const now = new Date('2026-12-01T00:00:00Z');
    expect(primaryTrip([augTrip, octTrip], now)).toBeNull();
  });
});

describe('logbook readiness', () => {
  const now = new Date('2026-09-18T14:00:00Z'); // after 5142 and 5388 have landed
  const flightRecord = (sourceLegId: string): FlightRecord => ({
    id: 'f1',
    date: '2026-09-18',
    from: 'KDAY',
    to: 'KCLT',
    aircraftId: 'crj700',
    blockMinutes: 81,
    seat: 'FO',
    sourceLegId,
  });

  it('finds legs that landed and are not yet logged', () => {
    const pending = pendingLogbookLegs([septTrip], [], now);
    expect(pending.map((p) => p.leg.flightNumber)).toEqual(['5142', '5388']);
  });

  it('excludes a leg once a flight record references it', () => {
    const leg1Id = septTrip.days[0].legs[0].id;
    const pending = pendingLogbookLegs([septTrip], [flightRecord(leg1Id)], now);
    expect(pending.map((p) => p.leg.flightNumber)).toEqual(['5388']);
  });

  it('never flags a deadhead or a leg still in the air', () => {
    // Before 5142 has landed, nothing is pending yet.
    const early = pendingLogbookLegs([septTrip], [], new Date('2026-09-18T09:00:00Z'));
    expect(early).toHaveLength(0);
  });

  it('orders pending legs earliest-arrival-first', () => {
    const pending = pendingLogbookLegs([septTrip], [], now);
    expect(pending[0].leg.flightNumber).toBe('5142');
    expect(pending[1].leg.flightNumber).toBe('5388');
  });

  it('scopes pendingLogbookLegsForDay to one duty day', () => {
    // 5119 CLT->DAY lands 12:31 EDT = 16:31Z.
    const day2Legs = pendingLogbookLegsForDay(septTrip.days[1], [], new Date('2026-09-19T17:00:00Z'));
    expect(day2Legs.map((l) => l.flightNumber)).toEqual(['5119']);
  });

  it('legIsLogged reflects sourceLegId matches only', () => {
    const leg1Id = septTrip.days[0].legs[0].id;
    expect(legIsLogged(leg1Id, [flightRecord(leg1Id)])).toBe(true);
    expect(legIsLogged(leg1Id, [flightRecord('other-leg')])).toBe(false);
    expect(legIsLogged(leg1Id, [])).toBe(false);
  });

  it('legIsComplete lets a manual "landed" status count even before scheduled arrival', () => {
    const leg: Leg = { id: 'x', kind: 'flight', from: 'KCLT', to: 'KDCA', depart: null, arrive: '2099-01-01T00:00:00Z', status: 'landed' };
    expect(legIsComplete(leg, new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });

  it('legIsComplete never counts a cancelled leg, whatever the clock says', () => {
    const leg: Leg = { id: 'x', kind: 'flight', from: 'KCLT', to: 'KDCA', depart: null, arrive: '2020-01-01T00:00:00Z', status: 'cancelled' };
    expect(legIsComplete(leg, new Date('2026-01-01T00:00:00Z'))).toBe(false);
  });

  it('legIsComplete never counts a deadhead', () => {
    const leg: Leg = { id: 'x', kind: 'deadhead', from: 'KCLT', to: 'KDCA', depart: null, arrive: '2020-01-01T00:00:00Z' };
    expect(legIsComplete(leg, new Date('2026-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('findTripForDate / appendFlightToTrips', () => {
  const leg = (flightNumber: string, id = `leg-${flightNumber}`): NewLegInput => ({
    id,
    kind: 'flight',
    flightNumber,
    from: 'KDEN',
    to: 'KORD',
    depart: null,
    arrive: null,
  });

  it('starts a brand-new trip when nothing is close', () => {
    const trips = appendFlightToTrips([], '2026-09-22', leg('UA1234'), 'day-1', 'trip-1');
    expect(trips).toHaveLength(1);
    expect(trips[0].days).toHaveLength(1);
    expect(trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['UA1234']);
  });

  it('adds a second flight on the same date to the same day', () => {
    let trips = appendFlightToTrips([], '2026-09-22', leg('UA1234'), 'day-1', 'trip-1');
    trips = appendFlightToTrips(trips, '2026-09-22', leg('UA5678'), 'day-2', 'trip-2');
    expect(trips).toHaveLength(1);
    expect(trips[0].days).toHaveLength(1);
    expect(trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['UA1234', 'UA5678']);
  });

  it('extends the same trip with a new day across a rest day gap', () => {
    let trips = appendFlightToTrips([], '2026-09-22', leg('UA1234'), 'day-1', 'trip-1');
    // Sep 23 is a pure layover day with no flight in this trip's data — the
    // next flight, two days later, should still land in the same trip.
    trips = appendFlightToTrips(trips, '2026-09-24', leg('UA4321'), 'day-2', 'trip-2');
    expect(trips).toHaveLength(1);
    expect(trips[0].days.map((d) => d.date)).toEqual(['2026-09-22', '2026-09-24']);
  });

  it('starts a new trip once the gap is too large', () => {
    let trips = appendFlightToTrips([], '2026-09-22', leg('UA1234'), 'day-1', 'trip-1');
    trips = appendFlightToTrips(trips, '2026-10-15', leg('UA9999'), 'day-2', 'trip-2');
    expect(trips).toHaveLength(2);
  });

  it('keeps days sorted by date regardless of insertion order', () => {
    let trips = appendFlightToTrips([], '2026-09-24', leg('UA4321'), 'day-1', 'trip-1');
    trips = appendFlightToTrips(trips, '2026-09-22', leg('UA1234'), 'day-2', 'trip-2');
    expect(trips[0].days.map((d) => d.date)).toEqual(['2026-09-22', '2026-09-24']);
  });

  it('sorts multiple same-day legs by departure time, not insertion order', () => {
    const early = { ...leg('UA1', 'l1'), depart: '2026-09-22T08:00:00Z' };
    const late = { ...leg('UA2', 'l2'), depart: '2026-09-22T20:00:00Z' };
    let trips = appendFlightToTrips([], '2026-09-22', late, 'day-1', 'trip-1');
    trips = appendFlightToTrips(trips, '2026-09-22', early, 'day-1', 'trip-2');
    expect(trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['UA1', 'UA2']);
  });

  it('picks the closest trip when several are within the window', () => {
    let trips = appendFlightToTrips([], '2026-09-01', leg('OLD'), 'd1', 't1');
    trips = appendFlightToTrips(trips, '2026-09-22', leg('NEW'), 'd2', 't2');
    // 2026-09-20 is 2 days from the Sep-22 trip, 19 days from the Sep-1 one.
    trips = appendFlightToTrips(trips, '2026-09-20', leg('MID'), 'd3', 't3');
    const withMid = trips.find((t) => t.days.some((d) => d.legs.some((l) => l.flightNumber === 'MID')));
    expect(withMid?.days.some((d) => d.legs.some((l) => l.flightNumber === 'NEW'))).toBe(true);
  });

  it('findTripForDate returns null when every trip is out of range', () => {
    const trips = appendFlightToTrips([], '2026-09-22', leg('UA1234'), 'day-1', 'trip-1');
    expect(findTripForDate(trips, '2027-01-01')).toBeNull();
  });
});
