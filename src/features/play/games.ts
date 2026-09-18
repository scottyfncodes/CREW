/**
 * Question generators for the Play section.
 *
 * Every question is generated from CREW's own curated datasets, so no answer
 * can be wrong in a way the reference screens are not also wrong. Generators
 * take a random source so they can be tested deterministically.
 */

import { AIRCRAFT } from '../../data/aircraft';
import { AIRPORTS } from '../../data/airportIndex';
import type { AircraftSpec, Airport } from '../../core/types';
import { greatCircleNm } from '../../core/calc/navigation';

export interface Question {
  id: string;
  prompt: string;
  /** Extra context shown under the prompt. */
  detail?: string;
  options: string[];
  answerIndex: number;
  /** Shown after answering — the thing actually worth learning. */
  explanation: string;
  link?: { label: string; to: string };
}

export type Rand = () => number;

function pick<T>(arr: T[], rand: Rand): T {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

function sample<T>(arr: T[], n: number, rand: Rand): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rand() * pool.length) % pool.length;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

function shuffleWithAnswer(correct: string, distractors: string[], rand: Rand): { options: string[]; answerIndex: number } {
  const options = [correct, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answerIndex: options.indexOf(correct) };
}

// --------------------------------------------------------------- aircraft

/** "Which aircraft is this?" from a set of published numbers. */
export function guessAircraft(rand: Rand = Math.random): Question {
  const target = pick(AIRCRAFT, rand);
  const others = sample(
    AIRCRAFT.filter((a) => a.id !== target.id),
    3,
    rand,
  );
  const label = (a: AircraftSpec) => a.variant.split(' (')[0];
  const { options, answerIndex } = shuffleWithAnswer(label(target), others.map(label), rand);

  return {
    id: `ac-${target.id}-${Math.floor(rand() * 1e6)}`,
    prompt: 'Which aircraft is this?',
    detail: [
      `${target.seats.typical} seats`,
      `${target.dimensions.wingspanFt.toFixed(1)} ft span`,
      `${target.weights.mtowLb.toLocaleString()} lb MTOW`,
      `${target.engines.count}× ${target.engines.model}`,
    ].join(' · '),
    options,
    answerIndex,
    explanation: target.engineering[0] ?? `${label(target)} — ${target.manufacturer}, ${target.icaoType}.`,
    link: { label: 'Full profile', to: `/deck/aircraft/${target.id}` },
  };
}

/** "Which of these is higher/longer/heavier?" */
export function aircraftSuperlative(rand: Rand = Math.random): Question {
  const metrics = [
    { key: 'range', label: 'the longest range', get: (a: AircraftSpec) => a.performance.rangeNm, unit: 'nm' },
    { key: 'mtow', label: 'the highest MTOW', get: (a: AircraftSpec) => a.weights.mtowLb, unit: 'lb' },
    { key: 'span', label: 'the greatest wingspan', get: (a: AircraftSpec) => a.dimensions.wingspanFt, unit: 'ft' },
    { key: 'seats', label: 'the most seats in a typical layout', get: (a: AircraftSpec) => a.seats.typical, unit: 'seats' },
  ];
  const metric = pick(metrics, rand);
  const contenders = sample(AIRCRAFT, 4, rand);
  const winner = contenders.reduce((best, a) => (metric.get(a) > metric.get(best) ? a : best));
  const label = (a: AircraftSpec) => a.variant.split(' (')[0];

  return {
    id: `sup-${metric.key}-${Math.floor(rand() * 1e6)}`,
    prompt: `Which has ${metric.label}?`,
    options: contenders.map(label),
    answerIndex: contenders.indexOf(winner),
    explanation: `${label(winner)} — ${Math.round(metric.get(winner)).toLocaleString()} ${metric.unit}.`,
    link: { label: 'Compare them', to: `/deck/compare?a=${contenders[0].id}&b=${winner.id}` },
  };
}

// ---------------------------------------------------------------- airport

/** "Which airport is this?" from elevation, runways and location. */
export function guessAirport(rand: Rand = Math.random): Question {
  const withRunways = AIRPORTS.filter((a) => a.runways.length > 0);
  const target = pick(withRunways, rand);
  const others = sample(
    withRunways.filter((a) => a.icao !== target.icao),
    3,
    rand,
  );
  const longest = Math.max(...target.runways.map((r) => r.lengthFt));
  const label = (a: Airport) => `${a.iata} — ${a.city}`;
  const { options, answerIndex } = shuffleWithAnswer(label(target), others.map(label), rand);

  return {
    id: `ap-${target.icao}-${Math.floor(rand() * 1e6)}`,
    prompt: 'Which airport is this?',
    detail: [
      `${target.elevationFt} ft elevation`,
      `${target.runways.length} runway${target.runways.length === 1 ? '' : 's'}`,
      `longest ${longest.toLocaleString()} ft`,
      `${target.region}`,
    ].join(' · '),
    options,
    answerIndex,
    explanation:
      target.notes?.[0] ?? `${target.name} — ${target.city}, ${target.region}. ${target.icao} / ${target.iata}.`,
    link: { label: 'Airport brief', to: `/deck/airport/${target.icao}` },
  };
}

/** "How far is it?" — distance estimation between two real airports. */
export function guessDistance(rand: Rand = Math.random): Question {
  const [a, b] = sample(AIRPORTS, 2, rand);
  const nm = Math.round(greatCircleNm(a.pos, b.pos));
  const spread = Math.max(40, Math.round(nm * 0.28));
  const distractors = [nm + spread, Math.max(10, nm - spread), nm + spread * 2].map((d) => `${d.toLocaleString()} nm`);
  const { options, answerIndex } = shuffleWithAnswer(`${nm.toLocaleString()} nm`, distractors, rand);

  return {
    id: `dist-${a.icao}-${b.icao}`,
    prompt: `How far is ${a.iata} from ${b.iata}?`,
    detail: `${a.city} to ${b.city}, great circle`,
    options,
    answerIndex,
    explanation: `${nm.toLocaleString()} nm direct — that is ${Math.round(nm / 7.0)} minutes at 420 kt, give or take the wind.`,
    link: { label: 'Great circle tool', to: '/deck/calc/gc' },
  };
}

/** Engine identification from thrust and architecture. */
export function guessEngine(rand: Rand = Math.random): Question {
  const target = pick(AIRCRAFT, rand);
  const others = sample(
    AIRCRAFT.filter((a) => a.engines.model !== target.engines.model),
    3,
    rand,
  );
  const { options, answerIndex } = shuffleWithAnswer(
    target.engines.model,
    others.map((a) => a.engines.model),
    rand,
  );

  return {
    id: `eng-${target.id}-${Math.floor(rand() * 1e6)}`,
    prompt: `What hangs on a ${target.variant.split(' (')[0]}?`,
    detail: target.engines.thrustLbf
      ? `${target.engines.count} engines, ${target.engines.thrustLbf.toLocaleString()} lbf each`
      : `${target.engines.count} engines`,
    options,
    answerIndex,
    explanation: `${target.engines.manufacturer} ${target.engines.model}${
      target.engines.bypassRatio ? `, bypass ratio about ${target.engines.bypassRatio}:1` : ''
    }.`,
    link: { label: 'Full profile', to: `/deck/aircraft/${target.id}` },
  };
}

export const GENERATORS: { id: string; name: string; blurb: string; make: (rand?: Rand) => Question }[] = [
  { id: 'guess-aircraft', name: 'Guess the aircraft', blurb: 'Identify the type from its published numbers.', make: guessAircraft },
  { id: 'guess-airport', name: 'Guess the airport', blurb: 'Elevation, runways and a state. Which field?', make: guessAirport },
  { id: 'guess-distance', name: 'Guess the distance', blurb: 'How far apart are two airports you fly?', make: guessDistance },
  { id: 'guess-engine', name: 'Engine identification', blurb: 'What is bolted to the back of it?', make: guessEngine },
  { id: 'superlative', name: 'Biggest, longest, heaviest', blurb: 'Rank four aircraft on one number.', make: aircraftSuperlative },
];

/** A deterministic pseudo-random source, seeded by the day. */
export function dailyRand(date = new Date()): Rand {
  const key = Number(`${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}`);
  let s = key % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
