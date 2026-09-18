import { describe, expect, it } from 'vitest';
import {
  casToTas,
  densityAltitudeFt,
  isaDeviationC,
  isaTempC,
  machToTas,
  pressureAltitudeFt,
  speedOfSoundKt,
  tasToCas,
  tasToMach,
} from './atmosphere';
import { favoredRunway, normalizeDeg, signedDelta, solveWindTriangle, windComponents } from './wind';
import {
  descentDistanceNm,
  gradientToAngleDeg,
  greatCircleNm,
  initialBearingDeg,
  requiredVerticalSpeedFpm,
  threeDegreeVsFpm,
  timeMinutes,
  topOfDescentNm,
} from './navigation';
import * as U from './units';

const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('standard atmosphere', () => {
  it('gives ISA temperature at known altitudes', () => {
    expect(isaTempC(0)).toBeCloseTo(15, 5);
    near(isaTempC(10000), -4.8, 0.1);
    near(isaTempC(36000), -56.3, 0.2);
    // Isothermal above the tropopause.
    expect(isaTempC(41000)).toBeCloseTo(-56.5, 5);
  });

  it('reports ISA deviation', () => {
    near(isaDeviationC(35000, -50), 4.3, 0.2);
    expect(isaDeviationC(0, 15)).toBeCloseTo(0, 5);
  });

  it('gives pressure altitude equal to field elevation on a standard day', () => {
    expect(pressureAltitudeFt(748, 29.92126)).toBeCloseTo(748, 1);
  });

  it('is close to, but not exactly, the 1000 ft per inch rule of thumb', () => {
    // The hypsometric form gives 938 ft for an inch low, not a flat 1000 —
    // which is the point of doing it properly rather than by rule of thumb.
    near(pressureAltitudeFt(0, 28.92), 938.4, 0.5);
    near(pressureAltitudeFt(0, 30.92), -911.1, 0.5);
    // A lower setting must always raise pressure altitude.
    expect(pressureAltitudeFt(0, 28.92)).toBeGreaterThan(pressureAltitudeFt(0, 30.92));
  });

  it('gives density altitude equal to pressure altitude at ISA temperature', () => {
    near(densityAltitudeFt(0, 15), 0, 5);
    near(densityAltitudeFt(5000, isaTempC(5000)), 5000, 20);
  });

  it('raises density altitude on a hot day', () => {
    // Denver-like field on a 35 C day sits thousands of feet higher.
    const da = densityAltitudeFt(5000, 35);
    expect(da).toBeGreaterThan(8000);
    expect(da).toBeLessThan(9000);
  });

  it('gives the standard sea-level speed of sound', () => {
    near(speedOfSoundKt(15), 661.5, 0.5);
  });
});

describe('airspeed relationships', () => {
  it('converts Mach to TAS and back', () => {
    // M0.78 at -50 C is 454 kt; at ISA for FL350 (-54.3 C) it is 450.
    near(machToTas(0.78, -50), 454.0, 0.5);
    near(machToTas(0.78, -54.3), 449.6, 0.5);
    expect(tasToMach(machToTas(0.78, -50), -50)).toBeCloseTo(0.78, 6);
  });

  it('gives TAS well above CAS at altitude', () => {
    // 280 KCAS at FL350 is about M0.82; TAS is 478 kt at -50 C.
    const tas = casToTas(280, 35000, -50);
    expect(tas).toBeGreaterThan(280);
    near(tas, 478.1, 0.5);
    near(tasToMach(tas, -50), 0.821, 0.002);
    // The 2% per 1000 ft rule of thumb lands in the same place.
    near(tas, 280 * 1.7, 5);
  });

  it('leaves CAS and TAS equal at sea level on a standard day', () => {
    near(casToTas(250, 0, 15), 250, 0.6);
  });

  it('round-trips CAS -> TAS -> CAS', () => {
    const cas = 280;
    const tas = casToTas(cas, 33000, -45);
    near(tasToCas(tas, 33000, -45), cas, 0.5);
  });
});

describe('wind components', () => {
  it('gives a pure headwind straight down the runway', () => {
    const c = windComponents(180, 180, 20);
    expect(c.headwindKt).toBeCloseTo(20, 6);
    expect(c.crosswindKt).toBeCloseTo(0, 6);
    expect(c.crosswindFrom).toBe('none');
  });

  it('gives a pure tailwind from directly behind', () => {
    const c = windComponents(180, 0, 20);
    expect(c.headwindKt).toBeCloseTo(-20, 6);
    expect(c.crosswindKt).toBeCloseTo(0, 6);
  });

  it('gives a pure crosswind at 90 degrees, and names the side', () => {
    const right = windComponents(180, 270, 20);
    expect(right.headwindKt).toBeCloseTo(0, 6);
    expect(right.crosswindKt).toBeCloseTo(20, 6);
    expect(right.crosswindFrom).toBe('right');

    const left = windComponents(180, 90, 20);
    expect(left.crosswindKt).toBeCloseTo(20, 6);
    expect(left.crosswindFrom).toBe('left');
  });

  it('splits a 45 degree wind evenly', () => {
    const c = windComponents(360, 45, 20);
    near(c.headwindKt, 14.1, 0.1);
    near(c.crosswindKt, 14.1, 0.1);
    expect(c.angleDeg).toBeCloseTo(45, 6);
  });

  it('handles the wrap around north', () => {
    const c = windComponents(10, 350, 15);
    expect(c.angleDeg).toBeCloseTo(20, 6);
    expect(c.crosswindFrom).toBe('left');
  });
});

describe('signedDelta and normalizeDeg', () => {
  it('normalises any bearing into 0-360', () => {
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(360)).toBe(0);
  });

  it('takes the short way round', () => {
    expect(signedDelta(350, 10)).toBe(20);
    expect(signedDelta(10, 350)).toBe(-20);
    expect(signedDelta(0, 180)).toBe(180);
  });
});

describe('favoredRunway', () => {
  const ends = [
    { ident: '18', headingDeg: 180 },
    { ident: '36', headingDeg: 0 },
    { ident: '05', headingDeg: 50 },
    { ident: '23', headingDeg: 230 },
  ];

  it('picks the end best aligned with the wind', () => {
    const r = favoredRunway(ends, 10, 15);
    expect(r?.ident).toBe('36');
    expect(r?.components.headwindKt).toBeGreaterThan(14);
  });

  it('picks the diagonal when the wind favours it', () => {
    expect(favoredRunway(ends, 60, 12)?.ident).toBe('05');
  });

  it('returns null with nothing to choose from', () => {
    expect(favoredRunway([], 180, 10)).toBeNull();
  });
});

describe('wind triangle', () => {
  it('gives no drift and reduced groundspeed in a pure headwind', () => {
    const t = solveWindTriangle(360, 280, 360, 40);
    expect(t?.wcaDeg).toBeCloseTo(0, 6);
    expect(t?.groundspeedKt).toBeCloseTo(240, 6);
  });

  it('crabs into the wind and names the direction', () => {
    const t = solveWindTriangle(360, 280, 90, 40)!;
    // Wind from the right means crab right.
    expect(t.wcaDeg).toBeGreaterThan(0);
    expect(t.headingDeg).toBeGreaterThan(0);
    expect(t.headingDeg).toBeLessThan(20);
  });

  it('refuses when the wind is stronger than the aircraft can hold', () => {
    expect(solveWindTriangle(360, 40, 90, 120)).toBeNull();
  });
});

describe('great circle navigation', () => {
  it('measures a known short leg', () => {
    // CLT to DCA is about 290-340 nm.
    const clt = { lat: 35.214, lon: -80.9431 };
    const dca = { lat: 38.8512, lon: -77.0402 };
    const nm = greatCircleNm(clt, dca);
    expect(nm).toBeGreaterThan(280);
    expect(nm).toBeLessThan(340);
  });

  it('is zero for a point to itself and symmetric', () => {
    const a = { lat: 35.214, lon: -80.9431 };
    const b = { lat: 39.9024, lon: -84.2194 };
    expect(greatCircleNm(a, a)).toBeCloseTo(0, 6);
    expect(greatCircleNm(a, b)).toBeCloseTo(greatCircleNm(b, a), 6);
  });

  it('gives a sensible initial course', () => {
    const day = { lat: 39.9024, lon: -84.2194 };
    const clt = { lat: 35.214, lon: -80.9431 };
    const brg = initialBearingDeg(day, clt);
    // Charlotte is south-east of Dayton.
    expect(brg).toBeGreaterThan(120);
    expect(brg).toBeLessThan(165);
  });
});

describe('descent geometry', () => {
  it('matches the 3:1 rule at a 3 degree gradient', () => {
    // 30,000 ft to lose at ~318 ft/nm is ~94 nm; the rule of thumb says 90.
    const d = descentDistanceNm(30000, 318)!;
    near(d, 94, 2);
  });

  it('converts a gradient to an angle', () => {
    near(gradientToAngleDeg(318), 3.0, 0.05);
  });

  it('computes the 3 degree vertical speed rule of thumb', () => {
    expect(threeDegreeVsFpm(420)).toBe(2100);
  });

  it('adds the level-off pad to top of descent', () => {
    const plain = topOfDescentNm(35000, 3000, 318, 0)!;
    const padded = topOfDescentNm(35000, 3000, 318, 10)!;
    expect(padded - plain).toBeCloseTo(10, 6);
  });

  it('gives the vertical speed a descent actually needs', () => {
    // 10,000 ft over 30 nm at 300 kt groundspeed = 6 minutes = ~1667 fpm.
    const vs = requiredVerticalSpeedFpm(10000, 30, 300)!;
    near(vs, 1667, 5);
  });

  it('refuses to divide by zero', () => {
    expect(descentDistanceNm(10000, 0)).toBeNull();
    expect(timeMinutes(100, 0)).toBeNull();
  });
});

describe('unit conversions', () => {
  it('round-trips distance', () => {
    near(U.nmToSm(U.smToNm(100)), 100, 0.001);
    near(U.nmToKm(100), 185.2, 0.1);
    near(U.mToFt(U.ftToM(1000)), 1000, 0.001);
  });

  it('converts temperature at the known anchors', () => {
    expect(U.cToF(0)).toBe(32);
    expect(U.cToF(100)).toBe(212);
    expect(U.fToC(-40)).toBeCloseTo(-40, 6);
    expect(U.cToK(0)).toBeCloseTo(273.15, 6);
  });

  it('converts pressure at the standard setting', () => {
    near(U.inHgToHpa(29.92), 1013.2, 0.5);
    near(U.hpaToInHg(1013.25), 29.92, 0.01);
  });

  it('converts fuel with the stated Jet A planning density', () => {
    expect(U.galToLb(100)).toBeCloseTo(670, 6);
    expect(U.lbToGal(670)).toBeCloseTo(100, 6);
    // Density is a parameter, not a hidden constant.
    expect(U.galToLb(100, 6.8)).toBeCloseTo(680, 6);
  });

  it('converts weight', () => {
    near(U.lbToKg(1000), 453.59, 0.01);
    near(U.kgToLb(1000), 2204.62, 0.01);
  });
});
