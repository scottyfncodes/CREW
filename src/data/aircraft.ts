/**
 * Curated aircraft reference data.
 *
 * REFERENCE ONLY. Figures are manufacturer/public-domain published values for
 * a representative build of each variant. Actual limits, weights and
 * performance for any given airframe come from the AFM and the company's
 * performance data — never from this file.
 */

import type { AircraftSpec } from '../core/types';

const bombardier = (url: string) => ({
  name: 'Manufacturer / type certificate data',
  url,
  kind: 'reference' as const,
});

export const AIRCRAFT: AircraftSpec[] = [
  {
    id: 'crj700',
    manufacturer: 'Bombardier',
    model: 'CRJ',
    variant: 'CRJ700 (CL-600-2C10)',
    icaoType: 'CRJ7',
    engines: {
      count: 2,
      manufacturer: 'General Electric',
      model: 'CF34-8C5',
      thrustLbf: 13790,
      type: 'turbofan',
      bypassRatio: 5.0,
    },
    seats: { typical: 70, max: 78 },
    dimensions: { lengthFt: 106.67, wingspanFt: 76.25, heightFt: 24.83, wingAreaSqFt: 760 },
    performance: {
      rangeNm: 1504,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.85,
      vmo: 335,
      ceilingFt: 41000,
      takeoffFieldFt: 5300,
    },
    weights: { mtowLb: 75000, mlwLb: 67000, oewLb: 44400, fuelCapacityLb: 19594 },
    history: [
      'Stretched from the CRJ200 with a 90-inch fuselage plug forward of the wing and a 68-inch plug aft.',
      'First flight 27 May 1999; entered service with Brit Air in 2001.',
      'Production of the CRJ family ended in 2020; Mitsubishi Heavy Industries acquired the programme and now supports the fleet.',
      'PSA Airlines operates the CRJ700 and CRJ900 for American Eagle.',
    ],
    engineering: [
      'The wing is an entirely new design versus the CRJ200 — greater span, more area, and leading-edge slats the -200 never had. That is why the -700 lands so much more benignly.',
      'The cabin floor was lowered relative to the CRJ200 to buy standing headroom, one of the few genuinely visible changes from inside.',
      'T-tail with the horizontal stabiliser clear of the engine efflux; deep-stall protection comes via a stick pusher.',
      'CF34-8C5 adds a FADEC and a much larger fan than the -3 series on the CRJ200, which is where most of the extra thrust and quiet comes from.',
      'APR (Automatic Performance Reserve) bumps the live engine to a higher thrust rating if the other one quits during takeoff.',
    ],
    sources: [bombardier('https://www.mhirj.com/en/aircraft/crj-series')],
  },
  {
    id: 'crj900',
    manufacturer: 'Bombardier',
    model: 'CRJ',
    variant: 'CRJ900 (CL-600-2D24)',
    icaoType: 'CRJ9',
    engines: {
      count: 2,
      manufacturer: 'General Electric',
      model: 'CF34-8C5',
      thrustLbf: 14510,
      type: 'turbofan',
      bypassRatio: 5.0,
    },
    seats: { typical: 76, max: 90 },
    dimensions: { lengthFt: 118.92, wingspanFt: 81.58, heightFt: 24.58, wingAreaSqFt: 765 },
    performance: {
      rangeNm: 1553,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.85,
      vmo: 335,
      ceilingFt: 41000,
      takeoffFieldFt: 6300,
    },
    weights: { mtowLb: 84500, mlwLb: 75100, oewLb: 47500, fuelCapacityLb: 19595 },
    history: [
      'A 12 ft 5 in stretch of the CRJ700, first flown 21 February 2001.',
      'US operators fly it at 76 seats because of scope clause limits, not because the airframe runs out of room at 90.',
      'The CRJ900 is the volume seller of the later CRJ family.',
    ],
    engineering: [
      'Longer fuselage means a longer tail-strike moment arm — rotation rate discipline matters more than in the -700.',
      'Extended wing span over the -700 and a wing root extension to carry the extra weight.',
      'Same CF34-8C5 core as the -700 but flat-rated higher, so hot-and-high performance degrades faster than raw thrust suggests.',
      'Shares a common type rating with the CRJ700 and CRJ200 — the differences are handled as differences training, which is exactly why regionals mix the fleet.',
    ],
    sources: [bombardier('https://www.mhirj.com/en/aircraft/crj-series')],
  },
  {
    id: 'crj200',
    manufacturer: 'Bombardier',
    model: 'CRJ',
    variant: 'CRJ200 (CL-600-2B19)',
    icaoType: 'CRJ2',
    engines: {
      count: 2,
      manufacturer: 'General Electric',
      model: 'CF34-3B1',
      thrustLbf: 8729,
      type: 'turbofan',
      bypassRatio: 6.2,
    },
    seats: { typical: 50, max: 50 },
    dimensions: { lengthFt: 87.83, wingspanFt: 69.58, heightFt: 20.42, wingAreaSqFt: 587 },
    performance: {
      rangeNm: 1700,
      cruiseMach: 0.74,
      cruiseKtas: 424,
      mmo: 0.85,
      vmo: 335,
      ceilingFt: 41000,
      takeoffFieldFt: 5800,
    },
    weights: { mtowLb: 53000, mlwLb: 47000, oewLb: 30500, fuelCapacityLb: 14305 },
    history: [
      'Derived directly from the Challenger 600 business jet — the airliner that started the regional jet era in North America.',
      'CRJ100 first flew 10 May 1991; the CRJ200 followed with more efficient CF34-3B1 engines.',
      'Over 1,000 CRJ100/200 airframes were built.',
    ],
    engineering: [
      'No leading-edge devices at all. The wing is clean, the approach speeds are high, and contaminated-runway performance is the limiting case far more often than on the -700.',
      'Its Challenger business-jet lineage shows in the narrow cabin cross-section and the low cabin ceiling.',
      'Hard wing plus a T-tail is precisely the configuration that makes ground-icing discipline non-negotiable.',
    ],
    sources: [bombardier('https://www.mhirj.com/en/aircraft/crj-series')],
  },
  {
    id: 'e175',
    manufacturer: 'Embraer',
    model: 'E-Jet',
    variant: 'E175 (ERJ 170-200 LR)',
    icaoType: 'E75L',
    engines: {
      count: 2,
      manufacturer: 'General Electric',
      model: 'CF34-8E5',
      thrustLbf: 14200,
      type: 'turbofan',
      bypassRatio: 5.0,
    },
    seats: { typical: 76, max: 88 },
    dimensions: { lengthFt: 103.92, wingspanFt: 93.92, heightFt: 32.33, wingAreaSqFt: 785 },
    performance: {
      rangeNm: 2200,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.82,
      vmo: 320,
      ceilingFt: 41000,
      takeoffFieldFt: 6800,
    },
    weights: { mtowLb: 85517, mlwLb: 74957, oewLb: 47900, fuelCapacityLb: 20600 },
    history: [
      'Part of the E-Jet family launched in 1999; the E175 entered service in 2006.',
      'The dominant 76-seat aircraft in US regional flying, and the CRJ900’s direct competitor.',
    ],
    engineering: [
      'Underwing engines rather than a rear-fuselage mounting — a cleaner wing, an easier CG story, and much simpler engine access than the CRJ.',
      'Four-abreast cabin with no middle seat, which is most of why passengers prefer it.',
      'Fly-by-wire on the spoilers and rudder only; the primary pitch and roll controls remain conventional.',
    ],
    sources: [
      { name: 'Embraer commercial aviation', url: 'https://www.embraercommercialaviation.com/', kind: 'reference' },
    ],
  },
  {
    id: 'e145',
    manufacturer: 'Embraer',
    model: 'ERJ',
    variant: 'ERJ 145 LR',
    icaoType: 'E145',
    engines: {
      count: 2,
      manufacturer: 'Rolls-Royce',
      model: 'AE 3007A1',
      thrustLbf: 8917,
      type: 'turbofan',
      bypassRatio: 5.0,
    },
    seats: { typical: 50, max: 50 },
    dimensions: { lengthFt: 98.0, wingspanFt: 65.75, heightFt: 22.17, wingAreaSqFt: 551 },
    performance: {
      rangeNm: 1550,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.78,
      vmo: 320,
      ceilingFt: 37000,
      takeoffFieldFt: 5600,
    },
    weights: { mtowLb: 48501, mlwLb: 42549, oewLb: 26100, fuelCapacityLb: 11400 },
    history: [
      'Stretched from the EMB 120 Brasilia turboprop lineage; first flight 11 August 1995.',
      'The CRJ200’s great rival through the 50-seat boom.',
    ],
    engineering: [
      'Three-abreast cabin — the narrowest jet most US passengers ever fly on.',
      'Supercritical wing derived from the Brasilia, with rear-mounted engines and a conventional low tail rather than a T-tail.',
    ],
    sources: [
      { name: 'Embraer commercial aviation', url: 'https://www.embraercommercialaviation.com/', kind: 'reference' },
    ],
  },
  {
    id: 'a319',
    manufacturer: 'Airbus',
    model: 'A320 family',
    variant: 'A319ceo',
    icaoType: 'A319',
    engines: {
      count: 2,
      manufacturer: 'CFM International',
      model: 'CFM56-5B',
      thrustLbf: 23500,
      type: 'turbofan',
      bypassRatio: 5.7,
    },
    seats: { typical: 128, max: 156 },
    dimensions: { lengthFt: 111.0, wingspanFt: 117.42, heightFt: 38.58, wingAreaSqFt: 1320 },
    performance: {
      rangeNm: 3700,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.82,
      vmo: 350,
      ceilingFt: 39800,
    },
    weights: { mtowLb: 166400, mlwLb: 137800, oewLb: 89100, fuelCapacityLb: 42900 },
    history: [
      'Shortened A320, first flight 25 August 1995.',
      'Common type rating across the whole A320 family — the commercial argument that built the family.',
    ],
    engineering: [
      'Full fly-by-wire with flight envelope protection and sidestick control; no control column, no back-drive.',
      'Sharklets on later builds trade a little span for a meaningful cruise drag reduction.',
      'The A319 is noticeably overpowered for its weight, which is why it climbs like it does.',
    ],
    sources: [{ name: 'Airbus aircraft data', url: 'https://aircraft.airbus.com/', kind: 'reference' }],
  },
  {
    id: 'a321neo',
    manufacturer: 'Airbus',
    model: 'A320 family',
    variant: 'A321neo',
    icaoType: 'A21N',
    engines: {
      count: 2,
      manufacturer: 'CFM International / Pratt & Whitney',
      model: 'LEAP-1A / PW1100G',
      thrustLbf: 32160,
      type: 'turbofan',
      bypassRatio: 11.0,
    },
    seats: { typical: 196, max: 244 },
    dimensions: { lengthFt: 146.0, wingspanFt: 117.42, heightFt: 38.58, wingAreaSqFt: 1320 },
    performance: {
      rangeNm: 4000,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.82,
      vmo: 350,
      ceilingFt: 39800,
    },
    weights: { mtowLb: 207000, mlwLb: 173000, oewLb: 110000, fuelCapacityLb: 52000 },
    history: [
      'The neo re-engining programme launched in 2010; the A321neo first flew in February 2016.',
      'Has comprehensively outsold its Boeing counterpart in the large-narrowbody segment.',
    ],
    engineering: [
      'Geared turbofan option (PW1100G) puts a reduction gearbox between the fan and the low-pressure turbine so each can run at its own efficient speed — the single biggest architectural change in narrowbody propulsion in decades.',
      'Very high bypass ratio means enormous nacelles and a real ground-clearance engineering problem on a 1980s landing gear.',
    ],
    sources: [{ name: 'Airbus aircraft data', url: 'https://aircraft.airbus.com/', kind: 'reference' }],
  },
  {
    id: 'b738',
    manufacturer: 'Boeing',
    model: '737',
    variant: '737-800 (Next Generation)',
    icaoType: 'B738',
    engines: {
      count: 2,
      manufacturer: 'CFM International',
      model: 'CFM56-7B27',
      thrustLbf: 27300,
      type: 'turbofan',
      bypassRatio: 5.1,
    },
    seats: { typical: 172, max: 189 },
    dimensions: { lengthFt: 129.5, wingspanFt: 117.42, heightFt: 41.17, wingAreaSqFt: 1341 },
    performance: {
      rangeNm: 2935,
      cruiseMach: 0.785,
      cruiseKtas: 450,
      mmo: 0.82,
      vmo: 340,
      ceilingFt: 41000,
    },
    weights: { mtowLb: 174200, mlwLb: 146300, oewLb: 91300, fuelCapacityLb: 46063 },
    history: [
      'Next Generation 737 launched in 1993; the -800 first flew 31 July 1997.',
      'The most-produced 737 variant and the workhorse of much of the world’s narrowbody fleet.',
    ],
    engineering: [
      'The flat-bottomed engine nacelle is a direct consequence of fitting a high-bypass CFM56 under a wing designed in the 1960s for short gear.',
      'Conventional cable-and-hydraulic flight controls with manual reversion — very different philosophy to the Airbus it competes with.',
    ],
    sources: [{ name: 'Boeing commercial airplanes', url: 'https://www.boeing.com/commercial', kind: 'reference' }],
  },
  {
    id: 'a220-300',
    manufacturer: 'Airbus',
    model: 'A220',
    variant: 'A220-300',
    icaoType: 'BCS3',
    engines: {
      count: 2,
      manufacturer: 'Pratt & Whitney',
      model: 'PW1521G',
      thrustLbf: 23300,
      type: 'turbofan',
      bypassRatio: 12.0,
    },
    seats: { typical: 141, max: 149 },
    dimensions: { lengthFt: 127.0, wingspanFt: 115.08, heightFt: 37.67, wingAreaSqFt: 1209 },
    performance: {
      rangeNm: 3350,
      cruiseMach: 0.78,
      cruiseKtas: 447,
      mmo: 0.82,
      vmo: 340,
      ceilingFt: 41000,
    },
    weights: { mtowLb: 149000, mlwLb: 129500, oewLb: 81000, fuelCapacityLb: 35000 },
    history: [
      'Launched by Bombardier as the CSeries CS300; first flight of the CS300 was 27 February 2015.',
      'Airbus took a majority stake in the programme in 2018 and renamed it the A220 — the same company lineage that produced the CRJ the pilot is flying.',
    ],
    engineering: [
      'Clean-sheet design: geared turbofans, a composite wing, and an aluminium-lithium fuselage, with none of the 1960s constraints the 737 and A320 carry.',
      'Five-abreast cabin (2-3) — a genuinely different cross-section rather than a narrowbody compromise.',
      'For a CRJ pilot this is the most direct descendant of the Bombardier commercial aircraft line.',
    ],
    sources: [{ name: 'Airbus A220', url: 'https://aircraft.airbus.com/en/aircraft/a220', kind: 'reference' }],
  },
];

const byId = new Map(AIRCRAFT.map((a) => [a.id, a]));

export function findAircraft(id: string | null | undefined): AircraftSpec | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

export function aircraftLabel(id: string | null | undefined): string {
  const a = findAircraft(id);
  return a ? a.variant.split(' (')[0] : '—';
}
