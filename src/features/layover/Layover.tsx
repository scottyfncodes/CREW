import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { buildContext } from '../../core/context/engine';
import { buildLayoverPlan, layoverBudget, scorePlace, type ScoredPlace } from '../../core/context/layover';
import { formatDuration, hourIn, timeIn } from '../../core/time/time';
import type { LayoverGuide, Place } from '../../core/types';
import { findAirport } from '../../data/airportIndex';
import { LAYOVER_GUIDES, fallbackLinks, guideByKey, guideForAirport } from '../../data/layovers';
import { nextSignificantWindow } from '../../services/weather';
import { setPlaceFeeling } from '../../store/actions';
import { activeTrip, type PlaceFeeling } from '../../store/state';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Panel, SourceLinks, Stat, Stats } from '../../ui/primitives';
import { useForecast } from '../weather/useWeather';

const CATEGORY_LABEL: Record<Place['category'], string> = {
  restaurant: 'Eat',
  coffee: 'Coffee',
  bakery: 'Bakery',
  bar: 'Drink',
  brewery: 'Brewery',
  market: 'Market',
  museum: 'Museum',
  park: 'Outdoors',
  walk: 'Walk',
  run: 'Run',
  landmark: 'Landmark',
  aviation: 'Aviation',
  oddity: 'Oddity',
};

const MICHELIN_LABEL: Record<NonNullable<Place['michelin']>['status'], string> = {
  'three-star': 'MICHELIN ★★★',
  'two-star': 'MICHELIN ★★',
  'one-star': 'MICHELIN ★',
  'bib-gourmand': 'Bib Gourmand',
  selected: 'MICHELIN Guide',
};

/** Layover hub: where am I, or where do I want to look? */
export function LayoverHub() {
  const state = useCrew();
  const now = useNow();
  const ctx = buildContext(state.pilot, activeTrip(state), now);
  const current = ctx.layover ?? ctx.nextLayover;
  const currentGuide = current ? guideForAirport(current.airport) : null;

  return (
    <>
      <TopBar title="Layover" />
      <Screen>
        {current && (
          <Panel title={ctx.layover ? 'You are here' : 'Coming up'} className="accent">
            <div className="big" style={{ fontSize: 24 }}>
              {current.city}
            </div>
            <div className="small dim" style={{ marginTop: 4 }}>
              {formatDuration(ctx.layover ? (now < current.end ? Math.round((current.end.getTime() - now.getTime()) / 60000) : 0) : current.minutes)}{' '}
              {ctx.layover ? 'until report' : 'on the ground'}
            </div>
            {currentGuide ? (
              <>
                <div className="divider" />
                <Link className="btn primary" to={`/layover/${currentGuide.key}`}>
                  Plan it
                </Link>
              </>
            ) : (
              <>
                <div className="divider" />
                <FallbackBlock code={current.airport} />
              </>
            )}
          </Panel>
        )}

        <Panel title="City guides">
          {LAYOVER_GUIDES.map((g) => (
            <Link key={g.key} className="row" to={`/layover/${g.key}`}>
              <div className="grow">
                <div className="strong">{g.city}</div>
                <div className="tiny faint">
                  {g.airports.map((a) => findAirport(a)?.iata ?? a).join(' · ')} · {g.places.length} places
                  {g.michelinCoverage.covered ? ' · MICHELIN city' : ''}
                </div>
              </div>
              <span className="chev">›</span>
            </Link>
          ))}
        </Panel>

        <Advisory>
          Curated and hand-checked, but hours, prices and MICHELIN status change constantly. Every entry links to its
          source — tap through before you build an evening around it.
        </Advisory>
      </Screen>
    </>
  );
}

function FallbackBlock({ code }: { code: string }) {
  const fb = fallbackLinks(code);
  return (
    <>
      <p className="small dim" style={{ margin: '0 0 8px' }}>
        CREW has no curated guide for {fb.city} yet. Rather than invent recommendations, here are the places to look.
      </p>
      <SourceLinks sources={fb.links} />
    </>
  );
}

/** A city guide, time-aware. */
export function LayoverCity() {
  const { key = '' } = useParams();
  const guide = guideByKey(key);
  const state = useCrew();
  const now = useNow();
  const ctx = buildContext(state.pilot, activeTrip(state), now);

  const airport = guide ? findAirport(guide.airports[0]) : null;
  const wx = useForecast(airport, 2);

  // The layover on the trip that matches this city — in progress, or coming up.
  const active = ctx.layover && guide?.airports.includes(ctx.layover.airport) ? ctx.layover : null;
  const upcoming = !active && ctx.nextLayover && guide?.airports.includes(ctx.nextLayover.airport) ? ctx.nextLayover : null;
  const live = active ?? upcoming;
  const liveMinutes = active
    ? Math.max(0, Math.round((active.end.getTime() - now.getTime()) / 60000))
    : (upcoming?.minutes ?? null);

  const [manualHours, setManualHours] = useState<number | null>(null);
  const totalMinutes = manualHours !== null ? manualHours * 60 : (liveMinutes ?? 5 * 60);

  const budget = layoverBudget(totalMinutes, state.pilot.prefs, live?.hotel?.transitMinutes ?? null);

  const cityTz = airport?.tz ?? 'UTC';
  // Plan around when the layover actually starts, not when you happen to be
  // reading this — a 10:00 look at an evening overnight should show dinner.
  const planFrom = active || manualHours !== null || !upcoming ? now : upcoming.start;
  const hour = hourIn(planFrom, cityTz);

  const weatherWindow = wx.result?.data ? nextSignificantWindow(wx.result.data, planFrom, 8) : null;
  const wet = weatherWindow !== null;

  const plan = useMemo(
    () =>
      buildLayoverPlan(guide, budget, {
        hour,
        prefs: state.pilot.prefs,
        feelings: state.placeFeelings,
        wetOutside: wet,
      }),
    [guide, budget.usableMinutes, budget.sleepMinutes, hour, state.pilot.prefs, state.placeFeelings, wet],
  );

  const allScored = useMemo(() => {
    if (!guide) return [];
    return guide.places
      .map((p) => scorePlace(p, { hour, usableMinutes: budget.usableMinutes, prefs: state.pilot.prefs, feelings: state.placeFeelings, wetOutside: wet }))
      .sort((a, b) => b.score - a.score);
  }, [guide, hour, budget.usableMinutes, state.pilot.prefs, state.placeFeelings, wet]);

  if (!guide) {
    return (
      <>
        <TopBar title="Layover" back />
        <Screen>
          <Empty glyph="◉" title="No guide for that city">
            <Link to="/layover">Back to the city list</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  return (
    <>
      <TopBar title={guide.city} back />
      <Screen>
        <p className="small dim" style={{ margin: '4px 0 14px' }}>
          {guide.intro}
        </p>

        <Panel title="How long have you got?">
          <div className="chips" style={{ marginBottom: 12 }}>
            {live && (
              <button
                type="button"
                className={`chip ${manualHours === null ? 'on' : ''}`}
                onClick={() => setManualHours(null)}
              >
                {active ? 'Live' : 'Your trip'} · {formatDuration(liveMinutes ?? 0)}
              </button>
            )}
            {[2, 5, 10, 18].map((h) => (
              <button key={h} type="button" className={`chip ${manualHours === h ? 'on' : ''}`} onClick={() => setManualHours(h)}>
                {h}h
              </button>
            ))}
          </div>
          <Stats>
            <Stat k="On ground" v={formatDuration(budget.totalMinutes)} />
            <Stat k="Sleep" v={formatDuration(budget.sleepMinutes)} sub="held back" />
            <Stat k="Transit" v={formatDuration(budget.transitMinutes)} sub="both ways" />
            <Stat k="Usable" v={formatDuration(budget.usableMinutes)} tone="accent" />
          </Stats>
          {live && manualHours === null && (
            <div className="tiny faint" style={{ marginTop: 8 }}>
              {active
                ? `Report at ${timeIn(live.end, cityTz)} local.`
                : `On the ground ${timeIn(live.start, cityTz)} to ${timeIn(live.end, cityTz)} local — planned around the evening you arrive.`}
            </div>
          )}
        </Panel>

        {weatherWindow && airport && (
          <Panel title="Weather in the window" className="caution">
            <div className="small caution-text">
              {weatherWindow.label} {timeIn(weatherWindow.start, airport.tz)}–{timeIn(weatherWindow.end, airport.tz)}
            </div>
            <div className="tiny faint" style={{ marginTop: 4 }}>
              Indoor options have been moved up the list.
            </div>
          </Panel>
        )}

        {plan.itinerary.length > 0 && (
          <Panel title="A plan that fits" className="accent">
            <div className="timeline">
              {plan.itinerary.map((it) => (
                <div key={it.place.id} className="tl-item next">
                  <div className="row" style={{ borderBottom: 0, padding: 0, gap: 10 }}>
                    <span className="mono strong" style={{ width: 48, flex: 'none' }}>
                      +{formatDuration(it.startOffsetMinutes)}
                    </span>
                    <div className="grow">
                      <div className="strong">{it.place.name}</div>
                      <div className="tiny faint">
                        {CATEGORY_LABEL[it.place.category]} · {formatDuration(it.place.dwellMinutes)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="tiny faint" style={{ marginTop: 8 }}>
              {plan.note}
            </div>
          </Panel>
        )}

        {plan.picks.length > 0 && (
          <>
            <div className="eyebrow">Worth your time</div>
            {plan.picks.map((s) => (
              <PlaceCard key={s.place.id} scored={s} feeling={state.placeFeelings[s.place.id] ?? null} />
            ))}
          </>
        )}

        <Panel title="MICHELIN coverage" className={guide.michelinCoverage.covered ? '' : 'caution'}>
          <p className="small dim" style={{ margin: 0 }}>
            {guide.michelinCoverage.note}
          </p>
          {guide.michelinCoverage.url && (
            <SourceLinks sources={[{ name: 'MICHELIN Guide', url: guide.michelinCoverage.url, kind: 'reference' }]} />
          )}
        </Panel>

        {guide.transitNote && (
          <Panel title="Getting around">
            <p className="small dim" style={{ margin: 0 }}>
              {guide.transitNote}
            </p>
            {guide.hotelHint && (
              <p className="small faint" style={{ margin: '8px 0 0' }}>
                {guide.hotelHint}
              </p>
            )}
          </Panel>
        )}

        <div className="eyebrow">Everything in {guide.city}</div>
        <AllPlaces guide={guide} scored={allScored} feelings={state.placeFeelings} />

        <SourceLinks sources={guide.sources} label="City sources:" />
        <div style={{ height: 10 }} />
        <Advisory>
          Hours and status change. Nothing here is booked, held or verified in real time — tap the links before you go.
        </Advisory>
      </Screen>
    </>
  );
}

function AllPlaces({
  guide,
  scored,
  feelings,
}: {
  guide: LayoverGuide;
  scored: ScoredPlace[];
  feelings: Record<string, PlaceFeeling>;
}) {
  const [filter, setFilter] = useState<Place['category'] | 'all'>('all');
  const categories = [...new Set(guide.places.map((p) => p.category))];
  const list = scored.filter((s) => filter === 'all' || s.place.category === filter);

  return (
    <>
      <div className="scroller" style={{ marginBottom: 12 }}>
        <button type="button" className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        {categories.map((c) => (
          <button key={c} type="button" className={`chip ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <Panel className="flush">
        <div className="list inset">
          {list.map((s) => (
            <PlaceCard key={s.place.id} scored={s} feeling={feelings[s.place.id] ?? null} compact />
          ))}
        </div>
      </Panel>
    </>
  );
}

function PlaceCard({ scored, feeling, compact }: { scored: ScoredPlace; feeling: PlaceFeeling | null; compact?: boolean }) {
  const p = scored.place;
  const toggle = (f: PlaceFeeling) => setPlaceFeeling(p.id, feeling === f ? null : f);

  // The full list is for browsing, so it stays one dense row per place. The
  // shortlist above is where the reasoning and the links belong.
  if (compact) {
    const maps = p.links[p.links.length - 1];
    return (
      <div className="row" style={{ opacity: feeling === 'not-interested' ? 0.42 : 1 }}>
        <div className="grow">
          <div className="small strong">
            {p.name}
            {p.michelin && <span className="chip michelin" style={{ marginLeft: 6, padding: '1px 7px' }}>★</span>}
          </div>
          <div className="tiny faint">
            {CATEGORY_LABEL[p.category]}
            {p.cuisine ? ` · ${p.cuisine}` : ''}
            {p.price ? ` · ${'$'.repeat(p.price)}` : ''} · {formatDuration(p.dwellMinutes)}
            {!scored.fits ? ' · too long for now' : ''}
          </div>
        </div>
        <button
          type="button"
          className={`chip ${feeling === 'saved' ? 'on' : ''}`}
          aria-label={`Save ${p.name}`}
          onClick={() => toggle('saved')}
        >
          ♥
        </button>
        {maps?.url && (
          <a className="chip" href={maps.url} target="_blank" rel="noreferrer noopener" aria-label={`Find ${p.name} on a map`}>
            ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <Panel>
      <div className="row" style={{ borderBottom: 0, padding: 0, alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="strong" style={{ fontSize: 16 }}>
            {p.name}
          </div>
          <div className="tiny faint" style={{ marginTop: 2 }}>
            {CATEGORY_LABEL[p.category]}
            {p.cuisine ? ` · ${p.cuisine}` : ''}
            {p.price ? ` · ${'$'.repeat(p.price)}` : ''} · {formatDuration(p.dwellMinutes)}
          </div>
        </div>
        {!scored.fits && <span className="chip caution">Too long</span>}
      </div>

      <p className="small dim" style={{ margin: '10px 0 0' }}>
        {p.why}
      </p>

      <div className="chips" style={{ marginTop: 10 }}>
        {p.michelin && <span className="chip michelin">{MICHELIN_LABEL[p.michelin.status]}</span>}
        {p.reservationRequired && <span className="chip caution">Reserve ahead</span>}
        {p.hours && <span className="chip caution">{p.hours}</span>}
      </div>

      {scored.reasons.length > 0 && (
        <div className="tiny faint" style={{ marginTop: 8 }}>
          Ranked up for: {scored.reasons.join(' · ')}
        </div>
      )}

      <SourceLinks sources={p.links} />

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className={`btn inline ${feeling === 'saved' ? 'primary' : 'ghost'}`} onClick={() => toggle('saved')}>
          ♥ Save
        </button>
        <button type="button" className={`btn inline ${feeling === 'visited' ? 'primary' : 'ghost'}`} onClick={() => toggle('visited')}>
          ★ Been
        </button>
        <button type="button" className={`btn inline ${feeling === 'not-interested' ? 'primary' : 'ghost'}`} onClick={() => toggle('not-interested')}>
          ✕ Not for me
        </button>
      </div>
    </Panel>
  );
}
