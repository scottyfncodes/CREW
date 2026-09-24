import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { cumulativeLimits, limitTone, type CumulativeLimit } from '../../core/context/limits';
import { pendingLogbookLegs } from '../../core/context/schedule';
import { airportVisits, fleetFromLog, logbookTotals } from '../../core/context/stats';
import { dateKeyIn, formatDuration, formatHoursDecimal, relative } from '../../core/time/time';
import { aircraftLabel, findAircraft } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { guideForAirport } from '../../data/layovers';
import { deleteFlight } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Panel, Stat, Stats } from '../../ui/primitives';

/**
 * Logbook: what actually happened. Fed by the schedule — a completed flight
 * shows up here to review before it becomes a permanent record — and by
 * whatever a pilot logs by hand.
 */
export function Logbook() {
  const state = useCrew();
  const now = useNow();
  const [tab, setTab] = useState<'fleet' | 'airports' | 'cities' | 'flights'>('fleet');

  const pending = useMemo(() => pendingLogbookLegs(state.trips, state.flights, now), [state.trips, state.flights, now]);
  const totals = useMemo(() => logbookTotals(state.flights, state.tails), [state.flights, state.tails]);
  const fleet = useMemo(() => fleetFromLog(state.flights, state.tails), [state.flights, state.tails]);
  const visits = useMemo(() => airportVisits(state.flights), [state.flights]);
  const today = dateKeyIn(now, findAirport(state.pilot.homeAirport)?.tz ?? 'UTC') ?? now.toISOString().slice(0, 10);
  const limits = useMemo(() => cumulativeLimits(state.flights, state.trips, today), [state.flights, state.trips, today]);
  const [editing, setEditing] = useState(false);
  const flightsNewestFirst = useMemo(
    () => [...state.flights].sort((a, b) => b.date.localeCompare(a.date)),
    [state.flights],
  );
  const cities = useMemo(() => {
    const map = new Map<string, { city: string; guideKey: string | null; visits: number }>();
    for (const v of visits) {
      const ap = findAirport(v.icao);
      if (!ap) continue;
      const guide = guideForAirport(ap.icao);
      const key = ap.city;
      const e = map.get(key) ?? { city: ap.city, guideKey: guide?.key ?? null, visits: 0 };
      e.visits += v.visits;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.visits - a.visits);
  }, [visits]);

  return (
    <>
      <TopBar
        title="Logbook"
        action={
          <Link className="chip" to="/schedule/add">
            + Flight
          </Link>
        }
      />
      <Screen>
        {pending.length > 0 && (
          <Panel title="Ready to log" className="accent">
            <p className="small dim" style={{ margin: '0 0 10px' }}>
              {pending.length} flight{pending.length === 1 ? '' : 's'} landed and {pending.length === 1 ? 'is' : 'are'} not
              in your logbook yet.
            </p>
            {pending.slice(0, 5).map(({ trip, day, leg }) => {
              const from = findAirport(leg.from);
              const to = findAirport(leg.to);
              return (
                <Link key={leg.id} className="row" to={`/logbook/review/${trip.id}/${day.id}/${leg.id}`}>
                  <div className="grow">
                    <div className="strong mono">
                      {from?.iata ?? leg.from} → {to?.iata ?? leg.to}
                    </div>
                    <div className="tiny faint">{leg.flightNumber ? `#${leg.flightNumber} · ` : ''}{relative(leg.arrive, now)}</div>
                  </div>
                  <span className="chip go">Review ›</span>
                </Link>
              );
            })}
            {pending.length > 5 && (
              <div className="tiny faint" style={{ marginTop: 6 }}>
                +{pending.length - 5} more — review them from Schedule.
              </div>
            )}
          </Panel>
        )}

        <Stats>
          <Stat k="Flights" v={totals.flights} />
          <Stat k="Hours" v={formatHoursDecimal(totals.blockMinutes)} />
          <Stat k="Airports" v={totals.airports} />
          <Stat k="Airframes" v={fleet.filter((f) => f.flights > 0).length} />
        </Stats>

        <LimitsPanel limits={limits.limits} includesSchedule={limits.includesSchedule} today={today} />

        <div className="scroller" style={{ margin: '14px 0 12px' }}>
          {(['fleet', 'airports', 'cities', 'flights'] as const).map((t) => (
            <button key={t} type="button" className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'fleet' ? 'My fleet' : t === 'airports' ? 'My airports' : t === 'cities' ? 'My cities' : 'My flights'}
            </button>
          ))}
        </div>

        {tab === 'fleet' && (
          <Panel className="flush">
            <div className="list inset">
              {fleet.length === 0 && <Empty glyph="✈" title="No airframes logged yet" />}
              {fleet.map((f) => {
                const spec = findAircraft(f.aircraftId);
                return (
                  <Link key={f.tail} className="row" to={`/deck/aircraft/${f.aircraftId}`}>
                    <span className="mono strong" style={{ width: 74, flex: 'none' }}>
                      {f.tail}
                    </span>
                    <div className="grow small">
                      <div>{aircraftLabel(f.aircraftId)}</div>
                      <div className="tiny faint mono">
                        {f.flights} flights · {formatDuration(f.blockMinutes)}
                        {f.first ? ` · first ${f.first}` : ''}
                      </div>
                      {spec && <div className="tiny faint">{spec.engines.model}</div>}
                    </div>
                    <span className="chev">›</span>
                  </Link>
                );
              })}
            </div>
          </Panel>
        )}

        {tab === 'airports' && (
          <Panel className="flush">
            <div className="list inset">
              {visits.length === 0 && <Empty glyph="◇" title="No airports logged yet" />}
              {visits.map((v) => (
                <Link key={v.icao} className="row" to={`/deck/airport/${v.icao}`}>
                  <span className="mono strong" style={{ width: 46, flex: 'none' }}>
                    {v.iata}
                  </span>
                  <div className="grow small">
                    <div>{v.city}</div>
                    <div className="tiny faint mono">
                      {v.visits} visits · {v.first} → {v.last}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'cities' && (
          <Panel className="flush">
            <div className="list inset">
              {cities.length === 0 && <Empty glyph="◉" title="No cities yet" />}
              {cities.map((c) => (
                <div key={c.city} className="row">
                  <div className="grow small">
                    <div className="strong">{c.city}</div>
                    <div className="tiny faint">{c.visits} times through</div>
                  </div>
                  {c.guideKey && (
                    <Link className="chip" to={`/layover/${c.guideKey}`}>
                      Guide ›
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'flights' && state.flights.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-4px 0 8px' }}>
            <button type="button" className={`chip ${editing ? 'on' : ''}`} onClick={() => setEditing((e) => !e)}>
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        )}

        {tab === 'flights' && (
          <Panel className="flush">
            <div className="list inset">
              {state.flights.length === 0 && (
                <Empty glyph="▤" title="No flights logged yet">
                  <Link to="/schedule/add">Add one by flight number</Link>
                </Empty>
              )}
              {flightsNewestFirst.slice(0, 200).map((f) => (
                <div key={f.id} className="row">
                  <span className="mono small faint" style={{ width: 90, flex: 'none', whiteSpace: 'nowrap' }}>
                    {f.date}
                  </span>
                  <div className="grow small">
                    <span className="mono strong">
                      {findAirport(f.from)?.iata ?? f.from} → {findAirport(f.to)?.iata ?? f.to}
                    </span>
                    <div className="tiny faint mono">
                      {aircraftLabel(f.aircraftId)}
                      {f.tail ? ` · ${f.tail}` : ''}
                      {f.sample ? ' · sample' : ''}
                    </div>
                  </div>
                  {editing ? (
                    <button
                      type="button"
                      className="chip warn"
                      onClick={() => {
                        const route = `${findAirport(f.from)?.iata ?? f.from} → ${findAirport(f.to)?.iata ?? f.to}`;
                        if (confirm(`Delete ${route} on ${f.date} from your logbook?`)) deleteFlight(f.id);
                      }}
                    >
                      Delete
                    </button>
                  ) : (
                    <span className="mono">{formatDuration(f.blockMinutes)}</span>
                  )}
                </div>
              ))}
              {flightsNewestFirst.length > 200 && (
                <div className="tiny faint" style={{ padding: '10px 0' }}>
                  Showing the latest 200 of {flightsNewestFirst.length}. Export the full logbook as CSV from Settings.
                </div>
              )}
            </div>
          </Panel>
        )}
      </Screen>
    </>
  );
}

/**
 * FAR 117 cumulative flight-time limits, today and at their peak across what
 * is already on the schedule — so a pilot sees a limit coming before a trip
 * pickup or swap pushes them into it.
 */
function LimitsPanel({ limits, includesSchedule, today }: { limits: CumulativeLimit[]; includesSchedule: boolean; today: string }) {
  if (limits.every((l) => l.peak.minutes === 0)) return null;
  return (
    <Panel title="Flight time limits" action={<span className="tiny faint">FAR 117.23</span>}>
      {limits.map((l) => {
        const tone = limitTone(l.peak.minutes, l.limitMinutes);
        const pct = Math.min(100, (l.todayMinutes / l.limitMinutes) * 100);
        const peakPct = Math.min(100, (l.peak.minutes / l.limitMinutes) * 100);
        const color = tone === 'warn' ? 'var(--warn)' : tone === 'caution' ? 'var(--caution)' : 'var(--accent)';
        return (
          <div key={l.label} style={{ marginBottom: 14 }}>
            <div className="row" style={{ borderBottom: 0, padding: '0 0 6px' }}>
              <span className="grow small">
                <span className="strong">Last {l.label}</span>
              </span>
              <span className="mono small">
                <span className="strong">{formatHoursDecimal(l.todayMinutes)}</span>
                <span className="faint"> / {l.limitMinutes / 60}h</span>
              </span>
            </div>
            <div className="bar limit-bar" aria-hidden>
              <span className="limit-peak" style={{ width: `${peakPct}%`, background: color }} />
              <span style={{ width: `${pct}%`, background: color }} />
            </div>
            {l.peak.date !== today && l.peak.minutes > l.todayMinutes && (
              <div className={`tiny ${tone === 'go' ? 'faint' : tone === 'caution' ? 'caution-text' : 'warn-text'}`} style={{ marginTop: 6 }}>
                Peaks at {formatHoursDecimal(l.peak.minutes)}h on {l.peak.date} with your schedule
                {tone === 'warn' ? ' — over the limit' : tone === 'caution' ? ' — close to the limit' : ''}
              </div>
            )}
          </div>
        );
      })}
      <Advisory>
        For awareness, not a legality check. Totals are block time from your logbook
        {includesSchedule ? ' plus scheduled flights not yet logged' : ''}, counted by calendar day — the 672-hour
        window is read as 28 days. Your company's crew tracking is the source of truth.
      </Advisory>
    </Panel>
  );
}
