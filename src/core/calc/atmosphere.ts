/**
 * Standard atmosphere and airspeed relationships.
 *
 * REFERENCE MATH ONLY. These are the textbook ISA formulas, not an approved
 * performance source. Nothing here substitutes for the AFM/FCOM or the
 * company's performance data.
 */

export const ISA_SEA_LEVEL_TEMP_C = 15;
export const ISA_SEA_LEVEL_PRESSURE_INHG = 29.92126;
export const ISA_LAPSE_C_PER_1000FT = 1.98;
export const TROPOPAUSE_FT = 36089;

/** ISA temperature at a pressure altitude, °C. Constant above the tropopause. */
export function isaTempC(pressureAltitudeFt: number): number {
  if (pressureAltitudeFt >= TROPOPAUSE_FT) return -56.5;
  return ISA_SEA_LEVEL_TEMP_C - (ISA_LAPSE_C_PER_1000FT * pressureAltitudeFt) / 1000;
}

/** Deviation of actual OAT from ISA at that altitude, °C. */
export function isaDeviationC(pressureAltitudeFt: number, oatC: number): number {
  return oatC - isaTempC(pressureAltitudeFt);
}

/**
 * Pressure altitude from field elevation and altimeter setting.
 * The familiar 1000 ft per inch approximation is not used; this is the
 * proper hypsometric form so it stays honest at high field elevations.
 */
export function pressureAltitudeFt(fieldElevationFt: number, altimeterInHg: number): number {
  const ratio = altimeterInHg / ISA_SEA_LEVEL_PRESSURE_INHG;
  return fieldElevationFt + 145366.45 * (1 - Math.pow(ratio, 0.190284));
}

/**
 * Density altitude, ft. Uses the standard relationship between pressure
 * altitude, actual temperature and ISA temperature.
 */
export function densityAltitudeFt(pressureAltFt: number, oatC: number): number {
  const tK = oatC + 273.15;
  if (tK <= 0) return NaN;
  // Density ratio: pressure ratio at this pressure altitude, scaled by how far
  // the actual temperature sits from standard sea level temperature.
  const pressureRatio = Math.pow(1 - 6.87535e-6 * pressureAltFt, 5.2558797);
  const sigma = (pressureRatio * 288.15) / tK;
  // Invert the standard density profile to the equivalent standard altitude.
  return (1 - Math.pow(sigma, 1 / 4.2558797)) / 6.87535e-6;
}

/** Local speed of sound, knots, for an outside air temperature in °C. */
export function speedOfSoundKt(oatC: number): number {
  const tK = oatC + 273.15;
  if (tK <= 0) return NaN;
  // a = 38.967854 * sqrt(T_K) knots
  return 38.967854 * Math.sqrt(tK);
}

/** True airspeed from Mach number and OAT. */
export function machToTas(mach: number, oatC: number): number {
  return mach * speedOfSoundKt(oatC);
}

/** Mach number from true airspeed and OAT. */
export function tasToMach(ktas: number, oatC: number): number {
  const a = speedOfSoundKt(oatC);
  return a > 0 ? ktas / a : NaN;
}

/**
 * Calibrated airspeed -> true airspeed, compressible form.
 * Instrument and position error are not modelled; CAS in, TAS out.
 */
export function casToTas(kcas: number, pressureAltFt: number, oatC: number): number {
  const p0 = 101325; // Pa
  const a0 = 661.4788; // kt, standard sea level speed of sound
  const pressureRatio = Math.pow(1 - 6.87535e-6 * pressureAltFt, 5.2558797);
  const p = p0 * pressureRatio;

  // Impact pressure from CAS (subsonic compressible flow).
  const qc = p0 * (Math.pow(1 + 0.2 * Math.pow(kcas / a0, 2), 3.5) - 1);
  // Mach from impact pressure at the actual static pressure.
  const mach = Math.sqrt(5 * (Math.pow(qc / p + 1, 2 / 7) - 1));
  return mach * speedOfSoundKt(oatC);
}

/** True airspeed -> calibrated airspeed, the inverse of `casToTas`. */
export function tasToCas(ktas: number, pressureAltFt: number, oatC: number): number {
  const p0 = 101325;
  const a0 = 661.4788;
  const pressureRatio = Math.pow(1 - 6.87535e-6 * pressureAltFt, 5.2558797);
  const p = p0 * pressureRatio;
  const mach = tasToMach(ktas, oatC);
  const qc = p * (Math.pow(1 + 0.2 * mach * mach, 3.5) - 1);
  return a0 * Math.sqrt(5 * (Math.pow(qc / p0 + 1, 2 / 7) - 1));
}
