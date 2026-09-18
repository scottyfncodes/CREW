import type { LayoverGuide, Place } from '../../core/types';
import { findAirport } from '../airportIndex';
import { michelinSearchUrl } from './build';
import { CLT } from './clt';
import { DCA } from './dca';
import { DAY } from './day';
import { PHL } from './phl';
import { BNA, CHS, ORF, PIT, TYS } from './more';

export const LAYOVER_GUIDES: LayoverGuide[] = [CLT, DCA, PHL, DAY, ORF, TYS, CHS, BNA, PIT];

const byAirport = new Map<string, LayoverGuide>();
for (const g of LAYOVER_GUIDES) {
  for (const icao of g.airports) byAirport.set(icao.toUpperCase(), g);
}

/** The curated guide covering an airport, if CREW has one. */
export function guideForAirport(code: string | null | undefined): LayoverGuide | null {
  const a = findAirport(code);
  if (!a) return null;
  return byAirport.get(a.icao.toUpperCase()) ?? null;
}

export function guideByKey(key: string): LayoverGuide | null {
  return LAYOVER_GUIDES.find((g) => g.key === key) ?? null;
}

export function findPlace(id: string): { place: Place; guide: LayoverGuide } | null {
  for (const g of LAYOVER_GUIDES) {
    const p = g.places.find((x) => x.id === id);
    if (p) return { place: p, guide: g };
  }
  return null;
}

/**
 * Honest fallback for a city CREW has no editorial guide for: no invented
 * recommendations, just the right places to look.
 */
export function fallbackLinks(code: string | null | undefined) {
  const a = findAirport(code);
  const city = a ? `${a.city}, ${a.region}` : (code ?? '').toUpperCase();
  return {
    city,
    links: [
      {
        name: 'MICHELIN Guide — search this city',
        url: michelinSearchUrl(city),
        kind: 'reference' as const,
      },
      {
        name: 'Maps — food near the airport',
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants near ${city}`)}`,
        kind: 'reference' as const,
      },
      {
        name: 'Maps — things to do',
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`things to do in ${city}`)}`,
        kind: 'reference' as const,
      },
    ],
  };
}
