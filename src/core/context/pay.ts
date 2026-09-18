/**
 * Earnings maths.
 *
 * CREW ships no contractual pay rules and no rate tables. Every number below
 * comes from a value the pilot typed into Settings and a duration derived
 * from their own trip. The breakdown is returned in full so nothing has to be
 * taken on trust.
 */

import type { Minutes, PayAssumptions, Trip } from '../types';
import { timeAwayMinutes, tripBlockMinutes, tripFlightMinutes } from './trip';

export type PayBasis = 'published-credit' | 'block-time' | 'unavailable';

export interface TripEarnings {
  basis: PayBasis;
  /** The hours the pay figure was computed from. */
  paidMinutes: Minutes | null;
  flightMinutes: Minutes | null;
  timeAwayMinutes: Minutes | null;
  flightPay: number | null;
  perDiem: number | null;
  total: number | null;
  /** Total divided by time away from base — the number that actually matters. */
  effectiveHourly: number | null;
  currency: string;
  /** Anything the pilot has not configured yet. */
  missing: string[];
}

export function tripEarnings(trip: Trip, pay: PayAssumptions): TripEarnings {
  const missing: string[] = [];
  const flightMinutes = tripFlightMinutes(trip);
  const blockMinutes = tripBlockMinutes(trip);
  const tafb = timeAwayMinutes(trip);

  let basis: PayBasis = 'unavailable';
  let paidMinutes: Minutes | null = null;
  if (trip.creditMinutes !== null && trip.creditMinutes !== undefined) {
    basis = 'published-credit';
    paidMinutes = trip.creditMinutes;
  } else if (blockMinutes !== null) {
    basis = 'block-time';
    paidMinutes = blockMinutes;
  }

  if (pay.hourlyRate === null) missing.push('hourly rate');
  if (pay.perDiemPerHour === null) missing.push('per diem rate');

  const flightPay =
    pay.hourlyRate !== null && paidMinutes !== null
      ? round2((paidMinutes / 60) * pay.hourlyRate)
      : null;

  const perDiem =
    pay.perDiemPerHour !== null && tafb !== null ? round2((tafb / 60) * pay.perDiemPerHour) : null;

  const total = flightPay === null && perDiem === null ? null : round2((flightPay ?? 0) + (perDiem ?? 0));

  const effectiveHourly = total !== null && tafb !== null && tafb > 0 ? round2(total / (tafb / 60)) : null;

  return {
    basis,
    paidMinutes,
    flightMinutes,
    timeAwayMinutes: tafb,
    flightPay,
    perDiem,
    total,
    effectiveHourly,
    currency: pay.currency,
    missing,
  };
}

/** Apply the monthly minimum guarantee, if one is configured. */
export function applyGuarantee(
  totalPaidMinutes: Minutes,
  pay: PayAssumptions,
): { paidMinutes: Minutes; guaranteeApplied: boolean } {
  if (pay.minGuaranteeHours === null) return { paidMinutes: totalPaidMinutes, guaranteeApplied: false };
  const guaranteeMinutes = pay.minGuaranteeHours * 60;
  if (totalPaidMinutes >= guaranteeMinutes) return { paidMinutes: totalPaidMinutes, guaranteeApplied: false };
  return { paidMinutes: guaranteeMinutes, guaranteeApplied: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatMoney(value: number | null, currency = 'USD'): string {
  if (value === null || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}
