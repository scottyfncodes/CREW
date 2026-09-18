/**
 * Wind components and the wind triangle.
 *
 * REFERENCE MATH ONLY — crosswind limits live in the AFM and the company's
 * operations manual, not here.
 */

export interface WindComponents {
  /** Positive is a headwind, negative is a tailwind. */
  headwindKt: number;
  /** Magnitude of the crosswind. */
  crosswindKt: number;
  /** Which side the crosswind comes from. */
  crosswindFrom: 'left' | 'right' | 'none';
  /** Angle between the wind and the runway/course, 0-180°. */
  angleDeg: number;
}

/** Normalise any bearing into [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Smallest signed turn from `from` to `to`, in (-180, 180]. */
export function signedDelta(from: number, to: number): number {
  let d = normalizeDeg(to) - normalizeDeg(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Resolve a wind into head/cross components relative to a course.
 * `runwayHeadingDeg` is the direction of travel; `windDirDeg` is the direction
 * the wind is coming FROM, as reported.
 */
export function windComponents(
  runwayHeadingDeg: number,
  windDirDeg: number,
  windSpeedKt: number,
): WindComponents {
  const delta = signedDelta(runwayHeadingDeg, windDirDeg);
  const rad = (delta * Math.PI) / 180;
  const head = windSpeedKt * Math.cos(rad);
  const crossSigned = windSpeedKt * Math.sin(rad);
  const cross = Math.abs(crossSigned);
  let from: WindComponents['crosswindFrom'] = 'none';
  if (cross >= 0.5) from = crossSigned > 0 ? 'right' : 'left';
  return {
    headwindKt: head,
    crosswindKt: cross,
    crosswindFrom: from,
    angleDeg: Math.abs(delta),
  };
}

/** The runway from a list that best faces the wind, with its actual components. */
export function favoredRunway(
  runways: { ident: string; headingDeg: number }[],
  windDirDeg: number,
  windSpeedKt: number,
): { ident: string; headingDeg: number; components: WindComponents } | null {
  if (runways.length === 0) return null;
  let best = runways[0];
  let bestAngle = Math.abs(signedDelta(best.headingDeg, windDirDeg));
  for (const r of runways.slice(1)) {
    const a = Math.abs(signedDelta(r.headingDeg, windDirDeg));
    if (a < bestAngle) {
      best = r;
      bestAngle = a;
    }
  }
  return {
    ident: best.ident,
    headingDeg: best.headingDeg,
    components: windComponents(best.headingDeg, windDirDeg, windSpeedKt),
  };
}

export interface WindTriangle {
  /** Heading to fly to hold the desired course. */
  headingDeg: number;
  /** Speed over the ground. */
  groundspeedKt: number;
  /** Wind correction angle, positive means crab right of course. */
  wcaDeg: number;
}

/**
 * Solve the wind triangle: given a course and TAS, find the heading and
 * groundspeed in a given wind. Returns null when the wind is too strong for
 * the course to be held at all.
 */
export function solveWindTriangle(
  courseDeg: number,
  ktas: number,
  windDirDeg: number,
  windSpeedKt: number,
): WindTriangle | null {
  if (ktas <= 0) return null;
  const windAngle = ((windDirDeg - courseDeg) * Math.PI) / 180;
  const sinWca = (windSpeedKt * Math.sin(windAngle)) / ktas;
  if (Math.abs(sinWca) > 1) return null; // cannot hold the course
  const wca = Math.asin(sinWca);
  const gs = ktas * Math.cos(wca) - windSpeedKt * Math.cos(windAngle);
  if (gs <= 0) return null;
  return {
    headingDeg: normalizeDeg(courseDeg + (wca * 180) / Math.PI),
    groundspeedKt: gs,
    wcaDeg: (wca * 180) / Math.PI,
  };
}
