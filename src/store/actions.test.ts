import { beforeEach, describe, expect, it } from 'vitest';
import { parseSchedule } from '../core/parse/schedule';
import { pendingLogbookLegs } from '../core/context/schedule';
import type { Trip } from '../core/types';
import {
  addFlightToSchedule,
  addTrip,
  deleteLeg,
  logFlight,
  logTripLegs,
  moveLeg,
  updateLeg,
} from './actions';
import { getState, setState } from './store';

/**
 * The store is a module-level singleton (by design — see store.ts), so each
 * test resets the slices it touches rather than reconstructing the module.
 */
beforeEach(() => {
  setState((s) => ({ ...s, trips: [], flights: [], tails: [], activeTripId: null }));
});

describe('addFlightToSchedule', () => {
  it('creates a trip from nothing and returns ids that resolve', () => {
    const { tripId, legId } = addFlightToSchedule('2026-09-22', {
      kind: 'flight',
      flightNumber: '1234',
      from: 'KDEN',
      to: 'KORD',
      depart: null,
      arrive: null,
    });
    const trip = getState().trips.find((t) => t.id === tripId);
    expect(trip).toBeTruthy();
    expect(trip!.days[0].legs.find((l) => l.id === legId)?.flightNumber).toBe('1234');
  });

  it('adds a second same-day flight into the same trip and day', () => {
    const first = addFlightToSchedule('2026-09-22', {
      kind: 'flight', flightNumber: '1234', from: 'KDEN', to: 'KORD', depart: null, arrive: null,
    });
    const second = addFlightToSchedule('2026-09-22', {
      kind: 'flight', flightNumber: '5678', from: 'KORD', to: 'KBOS', depart: null, arrive: null,
    });
    expect(second.tripId).toBe(first.tripId);
    expect(getState().trips).toHaveLength(1);
    expect(getState().trips[0].days).toHaveLength(1);
    expect(getState().trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['1234', '5678']);
  });

  it('starts a second trip once the flight is unrelated in time', () => {
    addFlightToSchedule('2026-09-22', { kind: 'flight', flightNumber: '1', from: 'KDEN', to: 'KORD', depart: null, arrive: null });
    addFlightToSchedule('2026-12-01', { kind: 'flight', flightNumber: '2', from: 'KDEN', to: 'KLAX', depart: null, arrive: null });
    expect(getState().trips).toHaveLength(2);
  });
});

describe('updateLeg / deleteLeg / moveLeg', () => {
  it('edits a field on a scheduled leg', () => {
    const { tripId, legId } = addFlightToSchedule('2026-09-22', {
      kind: 'flight', flightNumber: '1234', from: 'KDEN', to: 'KORD', depart: null, arrive: null,
    });
    const dayId = getState().trips[0].days[0].id;
    updateLeg(tripId, dayId, legId, { tail: 'N123AB' });
    expect(getState().trips[0].days[0].legs[0].tail).toBe('N123AB');
  });

  it('removes a leg, and an emptied day, and an emptied trip', () => {
    const { tripId, legId } = addFlightToSchedule('2026-09-22', {
      kind: 'flight', flightNumber: '1234', from: 'KDEN', to: 'KORD', depart: null, arrive: null,
    });
    const dayId = getState().trips[0].days[0].id;
    deleteLeg(tripId, dayId, legId);
    expect(getState().trips).toHaveLength(0);
  });

  it('keeps a day with a hotel even once its legs are gone', () => {
    const { tripId, legId } = addFlightToSchedule('2026-09-22', {
      kind: 'flight', flightNumber: '1234', from: 'KDEN', to: 'KORD', depart: null, arrive: null,
    });
    const dayId = getState().trips[0].days[0].id;
    setState((s) => ({
      ...s,
      trips: s.trips.map((t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? { ...d, hotel: { name: 'Hilton' } } : d)) })),
    }));
    deleteLeg(tripId, dayId, legId);
    expect(getState().trips[0]?.days).toHaveLength(1);
  });

  it('swaps two legs on reorder and refuses to move past either end', () => {
    const a = addFlightToSchedule('2026-09-22', { kind: 'flight', flightNumber: 'A', from: 'KDEN', to: 'KORD', depart: '2026-09-22T08:00:00Z', arrive: null });
    addFlightToSchedule('2026-09-22', { kind: 'flight', flightNumber: 'B', from: 'KORD', to: 'KBOS', depart: '2026-09-22T20:00:00Z', arrive: null });
    const dayId = getState().trips[0].days[0].id;
    moveLeg(a.tripId, dayId, a.legId, 'down');
    expect(getState().trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['B', 'A']);
    // Already at the front; moving up again is a no-op, not a crash.
    moveLeg(a.tripId, dayId, a.legId, 'up');
    expect(getState().trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['A', 'B']);
    moveLeg(a.tripId, dayId, a.legId, 'up');
    expect(getState().trips[0].days[0].legs.map((l) => l.flightNumber)).toEqual(['A', 'B']);
  });
});

describe('schedule -> logbook integrity', () => {
  const septTrip = (): Trip =>
    parseSchedule(
      'DAY 1 18SEP\nRPT 0515\n5142 DAY CLT 0600 0721\n5388 CLT DCA 0815 0932\nREL 1000',
      { anchorDate: '2026-09-18', anchorTz: 'America/New_York' },
    ).trip!;

  it('logTripLegs tags each record with the leg it came from', () => {
    const trip = septTrip();
    addTrip(trip);
    logTripLegs(trip, 'FO');
    const legId = trip.days[0].legs[0].id;
    const record = getState().flights.find((f) => f.sourceLegId === legId);
    expect(record).toBeTruthy();
    expect(record?.from).toBe('KDAY');
    expect(record?.to).toBe('KCLT');
    expect(record?.blockMinutes).toBe(81);
  });

  it('never double-logs the same leg', () => {
    const trip = septTrip();
    addTrip(trip);
    const first = logTripLegs(trip, 'FO');
    const second = logTripLegs(trip, 'FO');
    expect(first).toBe(2);
    expect(second).toBe(0);
    expect(getState().flights.filter((f) => f.sourceLegId)).toHaveLength(2);
  });

  it('logFlight itself refuses a duplicate sourceLegId', () => {
    logFlight({ date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO', sourceLegId: 'leg-1' });
    logFlight({ date: '2026-09-18', from: 'KDAY', to: 'KCLT', aircraftId: 'crj700', blockMinutes: 81, seat: 'FO', sourceLegId: 'leg-1' });
    expect(getState().flights.filter((f) => f.sourceLegId === 'leg-1')).toHaveLength(1);
  });

  it('clears pending review the moment a leg is logged', () => {
    const trip = septTrip();
    addTrip(trip);
    const now = new Date('2026-09-18T14:00:00Z');
    expect(pendingLogbookLegs([trip], getState().flights, now)).toHaveLength(2);
    logTripLegs(trip, 'FO');
    expect(pendingLogbookLegs([trip], getState().flights, now)).toHaveLength(0);
  });
});
