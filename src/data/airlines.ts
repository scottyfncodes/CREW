/**
 * Airline identity codes.
 *
 * A pilot types "5142". Depending on who is asking, that flight is AA5142 to
 * a passenger, OH5142 in the reservation system, and JIA5142 on the radio and
 * on ADS-B. Looking a flight up means knowing which form a given source wants.
 */

export interface Airline {
  /** Two-character IATA code, as printed on a boarding pass. */
  iata: string;
  /** Three-letter ICAO code, which is also the ADS-B callsign prefix. */
  icao: string;
  name: string;
  /** Radio callsign, for the pilots who enjoy knowing. */
  callsign: string;
  /** Regional carriers fly under a mainline brand. */
  operatesFor?: string;
}

export const AIRLINES: Airline[] = [
  // US regionals — the ones a PSA pilot shares a ramp with.
  { iata: 'OH', icao: 'JIA', name: 'PSA Airlines', callsign: 'Blue Streak', operatesFor: 'American Eagle' },
  { iata: 'PT', icao: 'PDT', name: 'Piedmont Airlines', callsign: 'Piedmont', operatesFor: 'American Eagle' },
  { iata: 'MQ', icao: 'ENY', name: 'Envoy Air', callsign: 'Envoy', operatesFor: 'American Eagle' },
  { iata: 'YX', icao: 'RPA', name: 'Republic Airways', callsign: 'Brickyard', operatesFor: 'American Eagle / Delta Connection / United Express' },
  { iata: 'OO', icao: 'SKW', name: 'SkyWest Airlines', callsign: 'SkyWest', operatesFor: 'Delta Connection / United Express / American Eagle / Alaska' },
  { iata: '9E', icao: 'EDV', name: 'Endeavor Air', callsign: 'Endeavor', operatesFor: 'Delta Connection' },
  { iata: 'YV', icao: 'ASH', name: 'Mesa Airlines', callsign: 'Air Shuttle', operatesFor: 'United Express' },
  { iata: 'ZW', icao: 'AWI', name: 'Air Wisconsin', callsign: 'Wisconsin', operatesFor: 'American Eagle' },
  { iata: 'G7', icao: 'GJS', name: 'GoJet Airlines', callsign: 'Lindbergh', operatesFor: 'United Express' },
  { iata: 'C5', icao: 'UCA', name: 'CommuteAir', callsign: 'Commutair', operatesFor: 'United Express' },
  { iata: 'QX', icao: 'QXE', name: 'Horizon Air', callsign: 'Horizon Air', operatesFor: 'Alaska' },

  // Mainline.
  { iata: 'AA', icao: 'AAL', name: 'American Airlines', callsign: 'American' },
  { iata: 'DL', icao: 'DAL', name: 'Delta Air Lines', callsign: 'Delta' },
  { iata: 'UA', icao: 'UAL', name: 'United Airlines', callsign: 'United' },
  { iata: 'WN', icao: 'SWA', name: 'Southwest Airlines', callsign: 'Southwest' },
  { iata: 'AS', icao: 'ASA', name: 'Alaska Airlines', callsign: 'Alaska' },
  { iata: 'B6', icao: 'JBU', name: 'JetBlue Airways', callsign: 'JetBlue' },
  { iata: 'NK', icao: 'NKS', name: 'Spirit Airlines', callsign: 'Spirit Wings' },
  { iata: 'F9', icao: 'FFT', name: 'Frontier Airlines', callsign: 'Frontier Flight' },
  { iata: 'G4', icao: 'AAY', name: 'Allegiant Air', callsign: 'Allegiant' },
  { iata: 'HA', icao: 'HAL', name: 'Hawaiian Airlines', callsign: 'Hawaiian' },
  { iata: 'SY', icao: 'SCX', name: 'Sun Country Airlines', callsign: 'Sun Country' },
  { iata: 'MX', icao: 'MXY', name: 'Breeze Airways', callsign: 'Moxy' },
];

const byIata = new Map(AIRLINES.map((a) => [a.iata, a]));
const byIcao = new Map(AIRLINES.map((a) => [a.icao, a]));

export function findAirline(code: string | null | undefined): Airline | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return byIata.get(c) ?? byIcao.get(c) ?? null;
}

/** Match an airline by the name the pilot typed into Settings. */
export function airlineByName(name: string | null | undefined): Airline | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return (
    AIRLINES.find((a) => a.name.toLowerCase() === n) ??
    AIRLINES.find((a) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase())) ??
    null
  );
}

export interface ParsedFlightNumber {
  /** Airline prefix as typed, if any. */
  prefix: string | null;
  airline: Airline | null;
  /** Digits only. */
  number: string;
}

/**
 * Split "OH5142", "AA 5142", "JIA5142" or a bare "5142" into its parts.
 * Returns null when there is no usable flight number in the input.
 */
export function parseFlightNumber(input: string): ParsedFlightNumber | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!raw) return null;

  // All digits is a bare flight number — the pilot's own airline is implied.
  if (/^\d{1,5}$/.test(raw)) return { prefix: null, airline: null, number: raw };

  // The prefix has to be a real carrier-code shape, otherwise a greedy match
  // eats a digit: "OH5142" must not parse as prefix "OH5", number "142".
  // IATA codes are two characters with at least one letter; ICAO are three
  // letters. A trailing letter (an operational suffix) is dropped.
  const m = /^([A-Z]{3}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{2})(\d{1,5})[A-Z]?$/.exec(raw);
  if (!m) return null;

  return { prefix: m[1], airline: findAirline(m[1]), number: m[2] };
}

/** The callsign ADS-B feeds broadcast, e.g. "JIA5142". */
export function toCallsign(number: string, airline: Airline | null): string | null {
  if (!airline) return null;
  return `${airline.icao}${number}`;
}

/** The form scheduling APIs expect, e.g. "OH5142". */
export function toIataFlightNumber(number: string, airline: Airline | null): string | null {
  if (!airline) return null;
  return `${airline.iata}${number}`;
}
