/**
 * Great-circle navigation, climb/descent geometry and time-speed-distance.
 *
 * REFERENCE MATH ONLY — not a flight planning system.
 */

import type { Position } from '../types';

export const EARTH_RADIUS_NM = 3440.065;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in nautical miles. */
export function greatCircleNm(a: Position, b: Position): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial true course from `a` to `b`, degrees true. */
export function initialBearingDeg(a: Position, b: Position): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Midpoint of the great circle between two positions. */
export function greatCircleMidpoint(a: Position, b: Position): Position {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const bx = Math.cos(lat2) * Math.cos(dLon);
  const by = Math.cos(lat2) * Math.sin(dLon);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  );
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
  return { lat: toDeg(lat3), lon: ((toDeg(lon3) + 540) % 360) - 180 };
}

// --- Time / speed / distance ------------------------------------------------

/** Minutes to cover a distance at a groundspeed. */
export function timeMinutes(distanceNm: number, groundspeedKt: number): number | null {
  if (groundspeedKt <= 0) return null;
  return (distanceNm / groundspeedKt) * 60;
}

export function distanceNm(groundspeedKt: number, minutes: number): number {
  return (groundspeedKt * minutes) / 60;
}

export function groundspeedKt(distanceNm: number, minutes: number): number | null {
  if (minutes <= 0) return null;
  return (distanceNm * 60) / minutes;
}

// --- Climb / descent geometry ----------------------------------------------

/** Vertical speed needed to lose/gain an altitude over a distance. */
export function requiredVerticalSpeedFpm(
  altitudeToLoseFt: number,
  distanceNm: number,
  groundspeedKt: number,
): number | null {
  const mins = timeMinutes(distanceNm, groundspeedKt);
  if (mins === null || mins === 0) return null;
  return altitudeToLoseFt / mins;
}

/** Distance needed for a descent at a given gradient, in nautical miles. */
export function descentDistanceNm(altitudeToLoseFt: number, feetPerNm: number): number | null {
  if (feetPerNm <= 0) return null;
  return altitudeToLoseFt / feetPerNm;
}

/** The 3:1 rule of thumb: nautical miles for a given altitude in thousands. */
export function threeToOneNm(altitudeToLoseFt: number): number {
  return (altitudeToLoseFt / 1000) * 3;
}

/** Descent gradient in feet per nautical mile. */
export function gradientFtPerNm(altitudeToLoseFt: number, distanceNm: number): number | null {
  if (distanceNm <= 0) return null;
  return altitudeToLoseFt / distanceNm;
}

/** Descent angle in degrees for a gradient. */
export function gradientToAngleDeg(feetPerNm: number): number {
  return toDeg(Math.atan(feetPerNm / 6076.12));
}

/** The classic "groundspeed / 2 x 10" vertical speed for a 3° path. */
export function threeDegreeVsFpm(groundspeedKt: number): number {
  return (groundspeedKt / 2) * 10;
}

/** Top of descent distance from the target, with an optional level-off pad. */
export function topOfDescentNm(
  cruiseAltFt: number,
  targetAltFt: number,
  feetPerNm: number,
  padNm = 0,
): number | null {
  const d = descentDistanceNm(cruiseAltFt - targetAltFt, feetPerNm);
  return d === null ? null : d + padNm;
}
