/**
 * The layover engine.
 *
 * Given how long you actually have, where you are, what time it is and what
 * you have told CREW you like, return a small number of things genuinely
 * worth doing — and a plan that fits between the hotel and the next report.
 *
 * This deliberately does not return fifty restaurants.
 */

import type { LayoverGuide, Minutes, Place, Preferences } from '../types';
import type { PlaceFeeling } from '../../store/state';

export interface LayoverBudget {
  /** Total clock time between release and next report. */
  totalMinutes: Minutes;
  /** Reserved for sleep before the next duty. */
  sleepMinutes: Minutes;
  /** Hotel <-> airport and hotel <-> town, both ways. */
  transitMinutes: Minutes;
  /** What is genuinely left to spend. Never negative. */
  usableMinutes: Minutes;
}

/**
 * Work out what is actually available. The sleep reserve is the pilot's
 * configured target, trimmed when the layover is too short to honour it —
 * CREW states the compromise rather than silently ignoring sleep.
 */
export function layoverBudget(
  totalMinutes: Minutes,
  prefs: Preferences,
  hotelTransitMinutes: Minutes | null,
): LayoverBudget {
  const transit = (hotelTransitMinutes ?? 25) * 2;
  // Below about 5 hours nobody is getting a full sleep anyway; protect a
  // proportionate rest instead of zeroing it out or demanding the full target.
  const sleep =
    totalMinutes >= prefs.sleepTargetMinutes + transit + 120
      ? prefs.sleepTargetMinutes
      : Math.max(0, Math.min(prefs.sleepTargetMinutes, Math.round(totalMinutes * 0.45)));
  const usable = Math.max(0, totalMinutes - sleep - transit);
  return { totalMinutes, sleepMinutes: sleep, transitMinutes: transit, usableMinutes: usable };
}

export interface ScoreContext {
  /** Local hour at the layover city, 0-23. */
  hour: number;
  usableMinutes: Minutes;
  prefs: Preferences;
  feelings: Record<string, PlaceFeeling>;
  /** True when the forecast says being outdoors is a bad idea. */
  wetOutside?: boolean;
}

export interface ScoredPlace {
  place: Place;
  score: number;
  /** Plain-language reasons, shown so the ranking is never a black box. */
  reasons: string[];
  fits: boolean;
}

const MEAL_WINDOWS: Record<string, [number, number]> = {
  breakfast: [5, 10],
  lunch: [11, 14],
  dinner: [17, 22],
};

function inWindow(hour: number, [a, b]: [number, number]): boolean {
  return hour >= a && hour < b;
}

export function scorePlace(place: Place, ctx: ScoreContext): ScoredPlace {
  let score = 50;
  const reasons: string[] = [];
  const tags = place.tags ?? [];

  // Does it physically fit in the time available?
  const fits = place.dwellMinutes <= ctx.usableMinutes;
  if (!fits) score -= 60;
  else if (place.dwellMinutes <= ctx.usableMinutes * 0.4) {
    score += 6;
  }

  // Time of day.
  const isFood = place.category === 'restaurant' || place.category === 'market';
  if (isFood) {
    if (inWindow(ctx.hour, MEAL_WINDOWS.dinner)) {
      score += 18;
      reasons.push("It's dinner time");
    } else if (inWindow(ctx.hour, MEAL_WINDOWS.lunch)) {
      score += 14;
      reasons.push("It's lunch time");
    } else if (inWindow(ctx.hour, MEAL_WINDOWS.breakfast) && tags.includes('early')) {
      score += 12;
      reasons.push('Open early');
    } else {
      score -= 8;
    }
  }
  if ((place.category === 'coffee' || place.category === 'bakery') && ctx.hour < 12) {
    score += 16;
    reasons.push('Morning coffee window');
    if (ctx.prefs.food.coffeeMatters) score += 6;
  }
  if (place.category === 'bar' || place.category === 'brewery') {
    if (ctx.hour >= 16 && ctx.hour < 24) score += 10;
    else score -= 20;
  }
  if (ctx.hour >= 22 || ctx.hour < 5) {
    if (tags.includes('late')) {
      score += 20;
      reasons.push('Still open this late');
    } else if (place.category !== 'walk' && place.category !== 'landmark') {
      score -= 25;
    }
  }

  // Michelin.
  if (place.michelin && ctx.prefs.food.wantsMichelin) {
    score += place.michelin.status === 'one-star' ? 18 : place.michelin.status === 'bib-gourmand' ? 12 : 22;
    reasons.push('MICHELIN listed');
  }

  // Price.
  if (place.price && place.price > ctx.prefs.food.maxPrice) {
    score -= 18;
    reasons.push('Above your usual price ceiling');
  }

  // Cuisine preference.
  if (place.cuisine && ctx.prefs.food.cuisines.length > 0) {
    const hit = ctx.prefs.food.cuisines.some((c) =>
      place.cuisine!.toLowerCase().includes(c.toLowerCase()),
    );
    if (hit) {
      score += 15;
      reasons.push('Cuisine you like');
    }
  }

  // Activity preference.
  if (ctx.prefs.activities.length > 0 && ctx.prefs.activities.includes(place.category)) {
    score += 12;
    reasons.push('Something you look for');
  }

  // Weather.
  const outdoors = tags.includes('outdoors') || place.category === 'park' || place.category === 'run' || place.category === 'walk';
  if (ctx.wetOutside) {
    if (outdoors) {
      score -= 22;
      reasons.push('Weather is against being outside');
    } else if (tags.includes('rainy-day')) {
      score += 12;
      reasons.push('Good option in this weather');
    }
  }

  // Reservations you realistically cannot get on a layover.
  if (place.reservationRequired && ctx.usableMinutes < 240) {
    score -= 14;
    reasons.push('Needs a reservation booked well ahead');
  }

  // Curation flags.
  if (tags.includes('must')) {
    score += 14;
    reasons.push('The thing this city is known for');
  }
  if (tags.includes('long-layover') && ctx.usableMinutes < 300) score -= 25;
  if (tags.includes('near-airport') && ctx.usableMinutes < 180) {
    score += 14;
    reasons.push('Close to the airport');
  }

  // What the pilot has told us.
  const feeling = ctx.feelings[place.id];
  if (feeling === 'saved') {
    score += 30;
    reasons.push('You saved this');
  }
  if (feeling === 'visited') {
    score -= 18;
    reasons.push("You've been");
  }
  if (feeling === 'not-interested') {
    score -= 200;
    reasons.push('You marked this as not interested');
  }

  return { place, score, reasons, fits };
}

export interface LayoverPlan {
  budget: LayoverBudget;
  /** Top picks, already filtered and ranked. */
  picks: ScoredPlace[];
  /** A realistic sequence that fits the usable time. */
  itinerary: { place: Place; startOffsetMinutes: Minutes }[];
  /** Why the itinerary stops where it does. */
  note: string;
}

const PICK_CATEGORY_CAP = 2;

export function buildLayoverPlan(
  guide: LayoverGuide | null,
  budget: LayoverBudget,
  ctx: Omit<ScoreContext, 'usableMinutes'>,
): LayoverPlan {
  if (!guide) {
    return {
      budget,
      picks: [],
      itinerary: [],
      note: 'CREW has no curated guide for this city yet — the links below go straight to the sources.',
    };
  }

  const scoreCtx: ScoreContext = { ...ctx, usableMinutes: budget.usableMinutes };
  const scored = guide.places
    .map((p) => scorePlace(p, scoreCtx))
    .filter((s) => s.score > -50)
    .sort((a, b) => b.score - a.score);

  // Keep the shortlist varied: at most two of any one category.
  const counts = new Map<string, number>();
  const picks: ScoredPlace[] = [];
  for (const s of scored) {
    const c = counts.get(s.place.category) ?? 0;
    if (c >= PICK_CATEGORY_CAP) continue;
    counts.set(s.place.category, c + 1);
    picks.push(s);
    if (picks.length >= 6) break;
  }

  // Itinerary: fit things in sequence, never repeating a category, leaving
  // 20% of the usable time as slack because layover plans always slip.
  const slack = Math.round(budget.usableMinutes * 0.2);
  let spent = 0;
  const used = new Set<string>();
  const itinerary: LayoverPlan['itinerary'] = [];
  for (const s of picks) {
    if (!s.fits) continue;
    if (used.has(s.place.category)) continue;
    if (spent + s.place.dwellMinutes + slack > budget.usableMinutes) continue;
    itinerary.push({ place: s.place, startOffsetMinutes: spent });
    spent += s.place.dwellMinutes + 15; // 15 min to get between things
    used.add(s.place.category);
    if (itinerary.length >= 4) break;
  }

  let note: string;
  if (budget.usableMinutes <= 0) {
    note = 'Once sleep and hotel transit are accounted for there is no usable time here. Rest.';
  } else if (itinerary.length === 0) {
    note = 'Nothing in the guide fits the time left after transit and sleep. The shortlist below is what to aim for on a longer sit.';
  } else {
    note = `Planned around ${Math.round(budget.usableMinutes / 60)}h of usable time with ${slack} min of slack left over.`;
  }

  return { budget, picks, itinerary, note };
}
