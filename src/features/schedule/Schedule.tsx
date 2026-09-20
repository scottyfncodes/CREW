import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { classifyTrips } from '../../core/context/schedule';
import { timeAwayMinutes, tripLegCount, tripRouteLine, tripStart } from '../../core/context/trip';
import { dateIn, formatDuration } from '../../core/time/time';
import type { Trip } from '../../core/types';
import { findAirport } from '../../data/airportIndex';
import { useCrew } from '../../store/store';
import { Empty, Panel } from '../../ui/primitives';

/**
 * Schedule: set up the trip. This is where a pilot builds their upcoming
 * flying one flight at a time and sees where they've already been — the
 * thing Today is generated from.
 */
export function Schedule() {
  const state = useCrew();
  const now = useNow();
  const { current, upcoming, past } = useMemo(() => classifyTrips(state.trips, now), [state.trips, now]);

  const empty = state.trips.length === 0;

  return (
    <>
      <TopBar title="Schedule" />
      <Screen>
        <Link className="btn primary" to="/schedule/add" style={{ marginBottom: 14 }}>
          + Add flight
        </Link>

        {empty && (
          <Empty glyph="◇" title="Nothing on the schedule">
            Add a flight by number and date, or{' '}
            <Link to="/schedule/import">paste a whole pairing</Link> if you have one.
          </Empty>
        )}

        {current.length > 0 && (
          <>
            <div className="eyebrow">Current trip</div>
            {current.map((t) => (
              <TripCard key={t.id} trip={t} kind="current" />
            ))}
          </>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="eyebrow">Upcoming</div>
            {upcoming.map((t) => (
              <TripCard key={t.id} trip={t} kind="upcoming" />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <div className="eyebrow">Past</div>
            {past.slice(0, 15).map((t) => (
              <TripCard key={t.id} trip={t} kind="past" />
            ))}
            {past.length > 15 && (
              <div className="tiny faint" style={{ textAlign: 'center', margin: '6px 0 14px' }}>
                {past.length - 15} more in your logbook
              </div>
            )}
          </>
        )}

        {!empty && (
          <Panel title="Have a whole pairing to paste?">
            <p className="small dim" style={{ margin: '0 0 10px' }}>
              For a multi-day trip you already have in text form, paste it in one go instead of adding each flight.
            </p>
            <Link className="btn ghost" to="/schedule/import">
              Paste a pairing
            </Link>
          </Panel>
        )}
      </Screen>
    </>
  );
}

function TripCard({ trip, kind }: { trip: Trip; kind: 'current' | 'upcoming' | 'past' }) {
  const start = tripStart(trip);
  const firstAp = findAirport(trip.days[0]?.legs[0]?.from);
  const tz = firstAp?.tz ?? 'UTC';
  const legCount = tripLegCount(trip);
  const tafb = timeAwayMinutes(trip);

  return (
    <Link to={`/schedule/trip/${trip.id}`} style={{ display: 'block', color: 'inherit' }}>
      <Panel className={kind === 'current' ? 'accent' : ''}>
        <div className="row" style={{ borderBottom: 0, padding: 0 }}>
          <div className="grow">
            <div className="strong">
              {trip.number ? `Trip ${trip.number}` : 'Trip'}
              {kind === 'current' && <span className="chip go" style={{ marginLeft: 8, padding: '1px 7px' }}>Now</span>}
            </div>
            <div className="tiny faint">
              {start ? dateIn(start, tz) : '—'}
              {trip.days.length > 1 ? ` – ${dateIn(trip.days[trip.days.length - 1].date + 'T12:00:00Z', tz)}` : ''}
              {' · '}
              {trip.days.length} day{trip.days.length === 1 ? '' : 's'} · {legCount} leg{legCount === 1 ? '' : 's'}
              {tafb !== null ? ` · ${formatDuration(tafb)} away` : ''}
            </div>
          </div>
          <span className="chev">›</span>
        </div>
        <div className="route" style={{ marginTop: 8, fontSize: 16 }}>
          {tripRouteLine(trip)}
        </div>
      </Panel>
    </Link>
  );
}
