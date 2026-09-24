import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { buildContext } from '../../core/context/engine';
import { dutyFlightTime, limitTone } from '../../core/context/limits';
import { legIsComplete, legIsLogged } from '../../core/context/schedule';
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
import { deleteLeg, deleteTrip, logTripLegs, moveLeg } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Panel, Stat, Stats } from '../../ui/primitives';
import { useForecast } from '../weather/useWeather';
import { WeatherLine } from '../weather/WeatherStrip';

export function TripDetail() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const state = useCrew();
  const now = useNow();
  const trip = state.trips.find((t) => t.id === tripId) ?? null;

  if (!trip) {
    return (
      <>
        <TopBar title="Trip" back />
        <Screen>
          <Empty glyph="◇" title="Trip not found">
            <Link to="/schedule">Back to Schedule</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  const ctx = buildContext(state.pilot, trip, now, state.flights);
  const layovers = tripLayovers(trip);
  const tafb = timeAwayMinutes(trip);
  const isCurrent = ctx.trip?.id === trip.id;

  return (
    <>
      <TopBar
        title={trip.number ? `Trip ${trip.number}` : 'Trip'}
        back
        action={
          <Link className="chip" to="/schedule/add">
            + Flight
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
            isToday={isCurrent && i === ctx.dayIndex}
            commuteApplies={i === 0}
            flights={state.flights}
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
            Pull every flown leg of this trip into your personal history in one go. Deadheads are skipped and a leg
            already logged is never re-added.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const n = logTripLegs(trip, state.pilot.seat);
              alert(n === 0 ? 'Nothing new to log — these legs are already in your logbook.' : `Logged ${n} leg${n === 1 ? '' : 's'}.`);
            }}
          >
            Log this whole trip
          </button>
        </Panel>

        <Panel title="Remove this trip">
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm('Remove this trip from your schedule? Anything already logged stays in your logbook.')) {
                deleteTrip(trip.id);
                navigate('/schedule');
              }
            }}
          >
            Delete trip
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
  flights,
}: {
  day: DutyDay;
  index: number;
  trip: Trip;
  now: Date;
  isToday: boolean;
  commuteApplies: boolean;
  flights: ReturnType<typeof useCrew>['flights'];
}) {
  const state = useCrew();
  const firstAp = findAirport(day.legs[0]?.from ?? state.pilot.baseAirport);
  const lastAp = findAirport(day.legs[day.legs.length - 1]?.to ?? state.pilot.baseAirport);
  const tz = firstAp?.tz ?? 'UTC';
  const duty = dayDutyMinutes(day);
  const dutyLimit = dutyFlightTime(day);
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
        <Stat
          k="Flight"
          v={formatHoursDecimal(dayFlightMinutes(day))}
          sub={dutyLimit.limitMinutes ? `of ${dutyLimit.limitMinutes / 60}h max` : 'hours'}
          tone={
            dutyLimit.limitMinutes && dutyLimit.flightMinutes !== null
              ? toneFor(limitTone(dutyLimit.flightMinutes, dutyLimit.limitMinutes))
              : undefined
          }
        />
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
        {day.legs.map((leg, li) => (
          <LegItem
            key={leg.id}
            leg={leg}
            now={now}
            tripId={trip.id}
            dayId={day.id}
            isFirst={li === 0}
            isLast={li === day.legs.length - 1}
            logged={legIsLogged(leg.id, flights)}
          />
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

function LegItem({
  leg,
  now,
  tripId,
  dayId,
  isFirst,
  isLast,
  logged,
}: {
  leg: Leg;
  now: Date;
  tripId: string;
  dayId: string;
  isFirst: boolean;
  isLast: boolean;
  logged: boolean;
}) {
  const [open, setOpen] = useState(false);
  const from = findAirport(leg.from);
  const to = findAirport(leg.to);
  const dep = leg.depart ? new Date(leg.depart) : null;
  const arr = leg.arrive ? new Date(leg.arrive) : null;
  const state: TimelineState = !dep || !arr ? 'future' : now >= arr ? 'done' : now >= dep ? 'now' : 'future';
  const complete = legIsComplete(leg, now);

  return (
    <div className={`tl-item ${state}`}>
      <button
        type="button"
        className="row"
        style={{ borderBottom: 0, padding: 0, gap: 10, textAlign: 'left', background: 'none' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mono strong" style={{ width: 52, flex: 'none' }}>
          {timeIn(leg.depart, from?.tz ?? 'UTC')}
        </span>
        <div className="grow">
          <div>
            <span className="strong">
              {from?.iata ?? leg.from} → {to?.iata ?? leg.to}
            </span>
            {leg.kind === 'deadhead' && <span className="chip caution" style={{ marginLeft: 8, padding: '2px 7px' }}>DH</span>}
            {complete && logged && <span className="chip go" style={{ marginLeft: 8, padding: '2px 7px' }}>Logged</span>}
            {complete && !logged && leg.kind === 'flight' && (
              <span className="chip caution" style={{ marginLeft: 8, padding: '2px 7px' }}>Ready to log</span>
            )}
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
      </button>

      {open && (
        <div style={{ padding: '8px 0 4px 62px' }}>
          <div className="btn-row">
            {complete && !logged && leg.kind === 'flight' && (
              <Link className="btn primary inline" to={`/logbook/review/${tripId}/${dayId}/${leg.id}`}>
                Review for logbook
              </Link>
            )}
            <Link className="btn ghost inline" to={`/schedule/leg/${tripId}/${dayId}/${leg.id}`}>
              Edit
            </Link>
            {!isFirst && (
              <button type="button" className="btn ghost inline" onClick={() => moveLeg(tripId, dayId, leg.id, 'up')}>
                ↑
              </button>
            )}
            {!isLast && (
              <button type="button" className="btn ghost inline" onClick={() => moveLeg(tripId, dayId, leg.id, 'down')}>
                ↓
              </button>
            )}
            <button
              type="button"
              className="btn danger inline"
              onClick={() => {
                if (confirm('Remove this flight from the schedule?')) deleteLeg(tripId, dayId, leg.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
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

/** Within limits reads as ordinary text; only getting close earns a colour. */
function toneFor(tone: ReturnType<typeof limitTone>): 'caution' | 'warn' | undefined {
  return tone === 'go' ? undefined : tone;
}
