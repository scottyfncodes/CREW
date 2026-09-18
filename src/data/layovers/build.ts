/**
 * Helpers for authoring layover guides.
 *
 * Rule for this dataset: never assert something that cannot be checked. Every
 * place carries at least a maps link so the pilot can confirm it exists, is
 * open, and is where we said it was. Hours are `null` unless they were
 * verified, and `null` renders as "check the link" rather than a guess.
 */

import type { MichelinStatus, Place, PlaceCategory, Position, Source } from '../../core/types';

export interface PlaceInput {
  id: string;
  name: string;
  category: PlaceCategory;
  why: string;
  cuisine?: string;
  price?: 1 | 2 | 3 | 4;
  michelin?: { status: MichelinStatus; asOf: string };
  pos?: Position;
  hours?: string | null;
  dwellMinutes: number;
  reservationRequired?: boolean;
  site?: string;
  michelinUrl?: string;
  tags?: string[];
}

function mapsLink(name: string, city: string): Source {
  return {
    name: 'Find on Maps',
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${city}`)}`,
    kind: 'reference',
  };
}

/** Build a Place with its provenance links wired up consistently. */
export function place(city: string, input: PlaceInput): Place {
  const links: Source[] = [];
  if (input.site) links.push({ name: 'Official site', url: input.site, kind: 'official' });
  if (input.michelinUrl) {
    links.push({
      name: 'MICHELIN Guide listing',
      url: input.michelinUrl,
      kind: 'reference',
      asOf: input.michelin?.asOf,
    });
  }
  links.push(mapsLink(input.name, city));

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    city,
    why: input.why,
    cuisine: input.cuisine,
    price: input.price,
    michelin: input.michelin ?? null,
    pos: input.pos,
    hours: input.hours ?? null,
    dwellMinutes: input.dwellMinutes,
    reservationRequired: input.reservationRequired ?? false,
    links,
    tags: input.tags,
  };
}

/** The guide's own search page for a city — the honest "verify this" link. */
export function michelinSearchUrl(city: string): string {
  return `https://guide.michelin.com/en/search?q=${encodeURIComponent(city)}`;
}
