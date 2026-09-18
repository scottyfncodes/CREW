/** Unit conversions used across CREW. Pure, exact where the definition is exact. */

// Distance
export const NM_PER_SM = 0.868976;
export const NM_PER_KM = 0.539957;
export const FT_PER_M = 3.280839895;

export const smToNm = (sm: number) => sm * NM_PER_SM;
export const nmToSm = (nm: number) => nm / NM_PER_SM;
export const kmToNm = (km: number) => km * NM_PER_KM;
export const nmToKm = (nm: number) => nm / NM_PER_KM;
export const mToFt = (m: number) => m * FT_PER_M;
export const ftToM = (ft: number) => ft / FT_PER_M;

// Temperature
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;
export const cToK = (c: number) => c + 273.15;

// Pressure
export const INHG_PER_HPA = 0.029529983;
export const hpaToInHg = (hpa: number) => hpa * INHG_PER_HPA;
export const inHgToHpa = (inHg: number) => inHg / INHG_PER_HPA;

// Speed
export const ktToMph = (kt: number) => kt * 1.150779;
export const mphToKt = (mph: number) => mph / 1.150779;
export const ktToKph = (kt: number) => kt * 1.852;
export const kphToKt = (kph: number) => kph / 1.852;
export const ktToMs = (kt: number) => kt * 0.514444;

// Fuel & weight. Jet A density varies with temperature; 6.7 lb/gal is the
// common planning figure and is what CREW labels its default as.
export const DEFAULT_JETA_LB_PER_GAL = 6.7;
export const KG_PER_LB = 0.45359237;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const galToLb = (gal: number, lbPerGal = DEFAULT_JETA_LB_PER_GAL) => gal * lbPerGal;
export const lbToGal = (lb: number, lbPerGal = DEFAULT_JETA_LB_PER_GAL) => lb / lbPerGal;
export const litersToGal = (l: number) => l * 0.264172;
export const galToLiters = (g: number) => g / 0.264172;

/** Round to n decimal places, returning a number (not a string). */
export function round(value: number, places = 0): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
