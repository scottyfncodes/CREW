/**
 * CREW core domain model.
 *
 * Everything in the app — preflight, weather, layover, pay, games, history —
 * reads from these types. Features must not invent parallel shapes for the
 * same concept; if a feature needs more, extend the model here.
 *
 * Convention: all instants are ISO-8601 strings with an explicit offset
 * (e.g. "2026-09-18T05:15:00-04:00"). Local wall-clock times are derived,
 * never stored bare. `null` means "genuinely unknown" and must render as
 * unknown rather than being guessed at.
 */

export type Iso = string; // ISO-8601 instant with offset
export type Minutes = number;

/** Where a piece of information came from. Attached to anything non-obvious. */
export interface Source {
  name: string;
  url?: string;
  /** Year/date the underlying data was published or last verified. */
  asOf?: string;
  /** Reference data, not an operational source of truth. */
  kind: 'official' | 'reference' | 'curated' | 'derived' | 'user';
}

export interface Position {
  lat: number;
  lon: number;
}

// ---------------------------------------------------------------------------
// Airports
// ---------------------------------------------------------------------------

export interface Runway {
  ident: string; // "18L/36R"
  lengthFt: number;
  widthFt?: number;
  surface?: string;
  /** Magnetic heading of the lower-numbered end. */
  headingDeg?: number;
}

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  region: string; // state / province
  country: string;
  pos: Position;
  elevationFt: number;
  /** IANA timezone, e.g. "America/New_York". */
  tz: string;
  runways: Runway[];
  website?: string;
  /** Short, verifiable notes a pilot would find interesting. */
  notes?: string[];
  /** Best place to go for spotting, if known. */
  spotting?: string;
  sources: Source[];
}

// ---------------------------------------------------------------------------
// Aircraft
// ---------------------------------------------------------------------------

export interface AircraftSpec {
  /** Stable key, e.g. "crj700". */
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  /** ICAO type designator, e.g. "CRJ7". */
  icaoType: string;
  engines: {
    count: number;
    manufacturer: string;
    model: string;
    /** Thrust per engine, lbf. */
    thrustLbf?: number;
    type: 'turbofan' | 'turboprop' | 'piston';
    bypassRatio?: number;
  };
  seats: { typical: number; max?: number };
  dimensions: {
    lengthFt: number;
    wingspanFt: number;
    heightFt: number;
    wingAreaSqFt?: number;
  };
  performance: {
    rangeNm: number;
    cruiseMach?: number;
    cruiseKtas?: number;
    mmo?: number;
    vmo?: number;
    ceilingFt: number;
    /** Balanced field length at MTOW, sea level, ISA — approximate. */
    takeoffFieldFt?: number;
  };
  weights: {
    mtowLb: number;
    mlwLb?: number;
    oewLb?: number;
    fuelCapacityLb: number;
  };
  /** Years in production / first flight / notable history. */
  history: string[];
  /** The engineering details that make this airplane itself. */
  engineering: string[];
  sources: Source[];
}

/** A specific airframe the pilot has actually touched. */
export interface Tail {
  registration: string; // "N705PS"
  aircraftId: string; // -> AircraftSpec.id
  serialNumber?: string;
  operator?: string;
  deliveredOn?: string;
  firstFlownByMe?: Iso;
  lastFlownByMe?: Iso;
  flightCount: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Schedule: Trip -> Duty -> Leg
// ---------------------------------------------------------------------------

export type LegKind = 'flight' | 'deadhead';

export interface Leg {
  id: string;
  kind: LegKind;
  flightNumber?: string | null;
  from: string; // ICAO or IATA as entered; resolved via airport lookup
  to: string;
  /** Scheduled departure/arrival. Null when the source did not give one. */
  depart: Iso | null;
  arrive: Iso | null;
  aircraftId?: string | null;
  tail?: string | null;
  /** Block time in minutes when stated by the source; otherwise derived. */
  blockMinutes?: Minutes | null;
}

export interface Hotel {
  name: string;
  address?: string;
  phone?: string;
  pos?: Position;
  /** Minutes from the airport, when known. */
  transitMinutes?: Minutes | null;
  confirmation?: string;
}

export interface DutyDay {
  id: string;
  /** Calendar date in the report airport's local time, YYYY-MM-DD. */
  date: string;
  reportAt: Iso | null;
  releaseAt: Iso | null;
  legs: Leg[];
  /** Overnight following this duty day, if any. */
  hotel?: Hotel | null;
  notes?: string;
}

export interface Trip {
  id: string;
  /** Pairing / trip number as printed by the company. */
  number?: string | null;
  days: DutyDay[];
  /** Credit hours as published by the company. Never computed into this field. */
  creditMinutes?: Minutes | null;
  perDiemRate?: number | null;
  notes?: string;
  /** Raw text the trip was parsed from, kept for provenance. */
  rawSource?: string;
}

// ---------------------------------------------------------------------------
// Pilot & preferences
// ---------------------------------------------------------------------------

export type CommuteMode = 'drive' | 'transit' | 'rideshare' | 'walk' | 'commute-by-air';

export interface PayAssumptions {
  /** Pilot-entered. CREW never ships contractual rates. */
  hourlyRate: number | null;
  perDiemPerHour: number | null;
  minGuaranteeHours: number | null;
  currency: string;
}

export interface Preferences {
  /** Minutes from leaving home to being at the airport, door to door. */
  commuteMinutes: Minutes;
  commuteMode: CommuteMode;
  /** Buffer between arriving at the airport and report time. */
  airportBufferMinutes: Minutes;
  /** Target sleep, used for the evening context card. */
  sleepTargetMinutes: Minutes;
  food: {
    cuisines: string[];
    maxPrice: 1 | 2 | 3 | 4;
    coffeeMatters: boolean;
    wantsMichelin: boolean;
  };
  activities: string[];
  /** 24h clock everywhere. Pilots do not want AM/PM. */
  use24h: boolean;
}

export interface Pilot {
  name: string;
  airline: string;
  homeAirport: string; // ICAO
  baseAirport: string; // ICAO
  seat: 'FO' | 'CA';
  fleet: string[]; // AircraftSpec ids
  pay: PayAssumptions;
  prefs: Preferences;
}

// ---------------------------------------------------------------------------
// Personal history & money
// ---------------------------------------------------------------------------

export interface FlightRecord {
  id: string;
  date: string; // YYYY-MM-DD
  from: string;
  to: string;
  aircraftId: string;
  tail?: string;
  blockMinutes: Minutes;
  seat: 'FO' | 'CA';
  note?: string;
  /** Seeded example data, shown with a badge and clearable in one tap. */
  sample?: boolean;
}

export type ExpenseCategory = 'food' | 'transport' | 'hotel' | 'supplies' | 'other';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  place?: string;
  city?: string;
  note?: string;
  reimbursable: boolean;
}

export interface PayPeriod {
  id: string;
  label: string; // "Sep 2026"
  start: string;
  end: string;
}

// ---------------------------------------------------------------------------
// Layover
// ---------------------------------------------------------------------------

export type PlaceCategory =
  | 'restaurant'
  | 'coffee'
  | 'bakery'
  | 'bar'
  | 'brewery'
  | 'market'
  | 'museum'
  | 'park'
  | 'walk'
  | 'run'
  | 'landmark'
  | 'aviation'
  | 'oddity';

export type MichelinStatus = 'three-star' | 'two-star' | 'one-star' | 'bib-gourmand' | 'selected';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string; // city key, matches LayoverGuide.key
  /** One line on why a pilot with limited time should care. */
  why: string;
  cuisine?: string;
  price?: 1 | 2 | 3 | 4;
  michelin?: { status: MichelinStatus; asOf: string } | null;
  pos?: Position;
  /** Free-text hours as published. Null when not verified. */
  hours?: string | null;
  /** Typical minutes to experience it, for itinerary fitting. */
  dwellMinutes: Minutes;
  /** Needs a reservation days ahead — matters a lot on a layover. */
  reservationRequired?: boolean;
  links: Source[];
  tags?: string[];
}

export interface LayoverGuide {
  key: string; // "clt"
  city: string;
  airports: string[]; // ICAO
  /** Where crews are typically put up, if commonly known. Not a company source. */
  hotelHint?: string;
  intro: string;
  /** Is this city in the MICHELIN Guide at all? Pilots ask this first. */
  michelinCoverage: { covered: boolean; note: string; url?: string };
  transitNote?: string;
  places: Place[];
  sources: Source[];
}
