import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { buildContext } from '../../core/context/engine';
import {
  dayDutyMinutes,
  dayFlightMinutes,
  leaveHomeAt,
  routeLine,
  timeAwayMinutes,
  tripFlightMinutes,
  tripLayovers,
  tripLegCount,
} from '../../core/context/trip';
import { dateIn, formatDuration, formatHoursDecimal, minutesBetween, relative, timeIn } from '../../core/time/time';
import type { DutyDay, Leg, Trip } from '../../core/types';
import { aircraftLabel } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { guideForAirport } from '../../data/layovers';
import { logTripLegs } from '../../store/actions';
import { activeTrip } from '../../store/state';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Panel, Stat, Stats } from '../../ui/primitives';
import { useForecast } from '../weather/useWeather';
import { WeatherLine } from '../weather/WeatherStrip';

export function Preflight() {
  const state = useCrew();
  const now = useNow();
  const trip = activeTrip(state);

  if (!trip) {
    return (
      <>
        <TopBar title="Preflight" />
        <Screen>
          <Empty glyph="◇" title="No trip loaded">
            <Link to="/import">Paste a pairing</Link> and CREW will build the trip.
          </Empty>
        </Screen>
      </>
    );
  }

  const ctx = buildContext(state.pilot, trip, now);
  const layovers = tripLayovers(trip);
  const tafb = timeAwayMinutes(trip);

  return (
    <>
      <TopBar
        title={trip.number ? `Trip ${trip.number}` : 'Trip'}
        back
        action={
          <Link className="chip" to="/import">
            New
          </Link>
        }
      />
      <Screen>
        <Panel title="The whole trip">
          <Stats>
            <Stat k="Days" v={trip.days.length} />
            <Stat k="Legs" v={tripLegCount(trip)} />
            <Stat k="Flight" v={formatHoursDecimal(tripFlightMinutes(trip))} sub="hours" />
            <Stat k="Away" v={formatDuration(tafb)} sub="TAFB" />
          </Stats>
          {trip.creditMinutes !== null && trip.creditMinutes !== undefined && (
            <div className="small dim" style={{ marginTop: 10 }}>
              Published credit <span className="mono strong">{formatHoursDecimal(trip.creditMinutes)}</span> h
            </div>
          )}
          <Advisory>
            Times shown are as they appeared in the source you gave CREW. Your company schedule and release are the
            operational record.
          </Advisory>
        </Panel>

        {trip.days.map((day, i) => (
          <DayBlock
            key={day.id}
            day={day}
            index={i}
            trip={trip}
            now={now}
            isToday={i === ctx.dayIndex}
            commuteApplies={i === 0}
          />
        ))}

        {layovers.length > 0 && (
          <Panel title="Layovers">
            {layovers.map((l) => {
              const guide = guideForAirport(l.airport);
              return (
                <Link key={l.airport + l.start.toISOString()} className="row" to={guide ? `/layover/${guide.key}` : '/layover'}>
                  <div className="grow">
                    <div className="strong">{l.city}</div>
                    <div className="small faint mono">
                      {formatDuration(l.minutes)} · {timeIn(l.start, findAirport(l.airport)?.tz ?? 'UTC')} →{' '}
                      {timeIn(l.end, findAirport(l.airport)?.tz ?? 'UTC')}
                    </div>
                    {l.hotel?.name && <div className="tiny faint">{l.hotel.name}</div>}
                  </div>
                  <span className="chev">›</span>
                </Link>
              );
            })}
          </Panel>
        )}

        <Panel title="Logbook">
          <p className="small dim" style={{ margin: '0 0 10px' }}>
            Pull every flown leg of this trip into your personal history. Deadheads are skipped and duplicates are not
            re-added.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const n = logTripLegs(trip, state.pilot.seat);
              alert(n === 0 ? 'Nothing new to log — these legs are already in your history.' : `Logged ${n} leg${n === 1 ? '' : 's'}.`);
            }}
          >
            Log this trip
          </button>
        </Panel>

        {trip.rawSource && (
          <Panel title="Source text">
            <pre
              className="mono tiny faint"
              style={{ whiteSpace: 'pre-wrap', margin: 0, maxHeight: 200, overflow: 'auto' }}
            >
              {trip.rawSource}
            </pre>
          </Panel>
        )}
      </Screen>
    </>
  );
}

function DayBlock({
  day,
  index,
  trip,
  now,
  isToday,
  commuteApplies,
}: {
  day: DutyDay;
  index: number;
  trip: Trip;
  now: Date;
  isToday: boolean;
  commuteApplies: boolean;
}) {
  const state = useCrew();
  const firstAp = findAirport(day.legs[0]?.from ?? state.pilot.baseAirport);
  const lastAp = findAirport(day.legs[day.legs.length - 1]?.to ?? state.pilot.baseAirport);
  const tz = firstAp?.tz ?? 'UTC';
  const duty = dayDutyMinutes(day);
  const leave = commuteApplies ? leaveHomeAt(day.reportAt, state.pilot.prefs) : null;
  const wx = useForecast(firstAp, 2);

  return (
    <Panel
      title={`Day ${index + 1} · ${dateIn(day.reportAt ?? day.legs[0]?.depart ?? `${day.date}T12:00:00Z`, tz)}`}
      className={isToday ? 'accent' : ''}
    >
      <div className="route" style={{ marginBottom: 10 }}>
        {routeLine(day)}
      </div>

      <Stats>
        <Stat k="Report" v={timeIn(day.reportAt, tz)} sub={firstAp?.iata} />
        <Stat k="Release" v={timeIn(day.releaseAt, findAirport(day.legs[day.legs.length - 1]?.to)?.tz ?? tz)} sub={lastAp?.iata} />
        <Stat k="Duty" v={formatDuration(duty.minutes)} sub={duty.basis === 'derived' ? 'block to block' : duty.basis === 'unknown' ? 'not published' : 'published'} />
        <Stat k="Flight" v={formatHoursDecimal(dayFlightMinutes(day))} sub="hours" />
      </Stats>

      {leave && (
        <div className="small" style={{ marginTop: 10 }}>
          Leave home <span className="mono strong accent-text">{timeIn(leave, findAirport(state.pilot.homeAirport)?.tz ?? tz)}</span>{' '}
          <span className="faint">
            ({formatDuration(state.pilot.prefs.commuteMinutes)} commute + {formatDuration(state.pilot.prefs.airportBufferMinutes)} buffer)
          </span>
        </div>
      )}

      {firstAp && wx.result?.data?.current && (
        <div className="small dim" style={{ marginTop: 8 }}>
          {firstAp.iata}: <WeatherLine result={wx.result} />
        </div>
      )}

      <div className="divider" />

      <div className="timeline">
        {day.reportAt && (
          <TimelineItem
            state={now >= new Date(day.reportAt) ? 'done' : 'next'}
            time={timeIn(day.reportAt, tz)}
            title="Report"
            sub={`${firstAp?.iata ?? ''} · ${relative(day.reportAt, now)}`}
          />
        )}
        {day.legs.map((leg) => (
          <LegItem key={leg.id} leg={leg} now={now} />
        ))}
        {day.releaseAt && (
          <TimelineItem
            state={now >= new Date(day.releaseAt) ? 'done' : 'future'}
            time={timeIn(day.releaseAt, findAirport(day.legs[day.legs.length - 1]?.to)?.tz ?? tz)}
            title="Release"
            sub={lastAp?.iata}
          />
        )}
        {day.hotel && (
          <TimelineItem
            state="future"
            time="RON"
            title={day.hotel.name}
            sub={[day.hotel.phone, day.hotel.transitMinutes ? `${day.hotel.transitMinutes} min from the field` : null]
              .filter(Boolean)
              .join(' · ')}
          />
        )}
      </div>

      {index === trip.days.length - 1 && day.releaseAt && (
        <div className="small dim" style={{ marginTop: 10 }}>
          Home around{' '}
          <span className="mono strong">
            {timeIn(
              new Date(new Date(day.releaseAt).getTime() + state.pilot.prefs.commuteMinutes * 60_000),
              findAirport(state.pilot.homeAirport)?.tz ?? tz,
            )}
          </span>{' '}
          <span className="faint">using your commute setting</span>
        </div>
      )}
    </Panel>
  );
}

function LegItem({ leg, now }: { leg: Leg; now: Date }) {
  const from = findAirport(leg.from);
  const to = findAirport(leg.to);
  const dep = leg.depart ? new Date(leg.depart) : null;
  const arr = leg.arrive ? new Date(leg.arrive) : null;
  const state: TimelineState = !dep || !arr ? 'future' : now >= arr ? 'done' : now >= dep ? 'now' : 'future';

  return (
    <div className={`tl-item ${state}`}>
      <div className="row" style={{ borderBottom: 0, padding: 0, gap: 10 }}>
        <span className="mono strong" style={{ width: 52, flex: 'none' }}>
          {timeIn(leg.depart, from?.tz ?? 'UTC')}
        </span>
        <div className="grow">
          <div>
            <span className="strong">
              {from?.iata ?? leg.from} → {to?.iata ?? leg.to}
            </span>
            {leg.kind === 'deadhead' && <span className="chip caution" style={{ marginLeft: 8, padding: '2px 7px' }}>DH</span>}
          </div>
          <div className="tiny faint mono">
            {leg.flightNumber ? `#${leg.flightNumber} · ` : ''}
            {formatDuration(leg.blockMinutes ?? minutesBetween(leg.depart, leg.arrive))}
            {leg.aircraftId ? ` · ${aircraftLabel(leg.aircraftId)}` : ''}
            {leg.tail ? ` · ${leg.tail}` : ''}
          </div>
        </div>
        <span className="mono faint" style={{ flex: 'none' }}>
          {timeIn(leg.arrive, to?.tz ?? 'UTC')}
        </span>
      </div>
    </div>
  );
}

type TimelineState = 'done' | 'now' | 'next' | 'future';

function TimelineItem({ state, time, title, sub }: { state: TimelineState; time: string; title: string; sub?: string }) {
  return (
    <div className={`tl-item ${state}`}>
      <div className="row" style={{ borderBottom: 0, padding: 0, gap: 10 }}>
        <span className="mono strong" style={{ width: 52, flex: 'none' }}>
          {time}
        </span>
        <div className="grow">
          <div className="strong">{title}</div>
          {sub && <div className="tiny faint">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
