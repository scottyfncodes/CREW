import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { buildContext, greeting, homeCards, type HomeCardKind, type PilotContext } from '../../core/context/engine';
import { layoverBudget, buildLayoverPlan } from '../../core/context/layover';
import { dayFlightMinutes, routeLine } from '../../core/context/trip';
import { formatDuration, hourIn, minutesBetween, relative, timeIn, zoneAbbr } from '../../core/time/time';
import { aircraftLabel } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { guideForAirport } from '../../data/layovers';
import { useCrew } from '../../store/store';
import { activeTrip } from '../../store/state';
import { dismissSampleBanner } from '../../store/actions';
import { Panel, Stat, Stats } from '../../ui/primitives';
import { useForecast } from '../weather/useWeather';
import { WeatherLine, WeatherStrip } from '../weather/WeatherStrip';
import { nextSignificantWindow } from '../../services/weather';

export function Home() {
  const state = useCrew();
  const now = useNow();
  const trip = activeTrip(state);
  const ctx = buildContext(state.pilot, trip, now);
  const cards = homeCards(ctx);

  const focusIcao = ctx.locationIcao ?? state.pilot.homeAirport;
  const focusAirport = findAirport(focusIcao);
  const wx = useForecast(focusAirport, 2);

  const hasSample = state.flights.some((f) => f.sample);

  return (
    <>
      <TopBar
        title="CREW"
        action={
          <Link to="/settings" className="chip" aria-label="Settings">
            ⚙
          </Link>
        }
      />
      <Screen>
        {hasSample && !state.sampleDismissed && (
          <div className="banner">
            <span className="grow">
              Showing a sample pairing and logbook so nothing is empty. Import your own with{' '}
              <Link to="/import">Make Sense Of This</Link>.
            </span>
            <button type="button" onClick={dismissSampleBanner}>
              Got it
            </button>
          </div>
        )}

        <HeroBlock ctx={ctx} now={now} />

        {cards.map((kind) => (
          <HomeCard key={kind} kind={kind} ctx={ctx} wx={wx} focusIcao={focusIcao} now={now} />
        ))}
      </Screen>
    </>
  );
}

function HeroBlock({ ctx, now }: { ctx: PilotContext; now: Date }) {
  const ap = findAirport(ctx.locationIcao);
  const tz = ap?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = ctx.day;

  return (
    <div style={{ padding: '6px 0 16px' }}>
      <div className="eyebrow" style={{ margin: '0 0 6px' }}>
        {greeting(ctx)} · {ap ? `${ap.iata} local` : 'local'}
      </div>
      <div className="hero-time">{timeIn(now, tz)}</div>
      <div className="small dim" style={{ marginTop: 4 }}>
        {zoneAbbr(now, tz)}
        {ctx.state === 'layover' && ctx.layover ? ` · on a layover in ${ctx.layover.city}` : ''}
        {ctx.state === 'no-trip' ? ' · nothing on the schedule' : ''}
      </div>
      {day && day.legs.length > 0 && (
        <div className="route" style={{ marginTop: 14 }}>
          {routeLine(day)}
        </div>
      )}
    </div>
  );
}

function HomeCard({
  kind,
  ctx,
  wx,
  focusIcao,
  now,
}: {
  kind: HomeCardKind;
  ctx: PilotContext;
  wx: ReturnType<typeof useForecast>;
  focusIcao: string;
  now: Date;
}) {
  const state = useCrew();
  const ap = findAirport(focusIcao);

  switch (kind) {
    case 'leave-home': {
      if (!ctx.leaveHome) return null;
      const homeAp = findAirport(state.pilot.homeAirport);
      const tz = homeAp?.tz ?? 'UTC';
      const late = (ctx.minutesToLeaveHome ?? 0) < 0;
      return (
        <Panel title="Leave home" className="accent">
          <div className="big" style={{ color: late ? 'var(--warn)' : 'var(--accent)' }}>
            {timeIn(ctx.leaveHome, tz)}
          </div>
          <div className="small dim" style={{ marginTop: 4 }}>
            {late ? `You should have left ${formatDuration(-(ctx.minutesToLeaveHome ?? 0))} ago` : relative(ctx.leaveHome, now)}
          </div>
          <div className="divider" />
          <Stats>
            <Stat k="Commute" v={formatDuration(state.pilot.prefs.commuteMinutes)} sub={state.pilot.prefs.commuteMode} />
            <Stat k="Airport buffer" v={formatDuration(state.pilot.prefs.airportBufferMinutes)} />
            <Stat k="Report" v={timeIn(ctx.reportAt, tz)} sub={homeAp?.iata} />
          </Stats>
          <p className="advisory">
            <strong>Your numbers.</strong> Built from the commute and buffer you set in Settings, not a company time.
          </p>
        </Panel>
      );
    }

    case 'report': {
      if (!ctx.reportAt) return null;
      const firstLeg = ctx.day?.legs[0];
      const reportAp = findAirport(firstLeg?.from ?? state.pilot.baseAirport);
      const tz = reportAp?.tz ?? 'UTC';
      return (
        <Panel title={ctx.dayIndex === 0 ? 'Report' : `Day ${ctx.dayIndex + 1} report`}>
          <div className="big">{timeIn(ctx.reportAt, tz)}</div>
          <div className="small dim" style={{ marginTop: 4 }}>
            {reportAp?.iata ?? '—'} · {relative(ctx.reportAt, now)}
          </div>
          {ctx.leaveHome && (
            <div className="small" style={{ marginTop: 10 }}>
              Leave home <span className="mono strong accent-text">{timeIn(ctx.leaveHome, findAirport(state.pilot.homeAirport)?.tz ?? tz)}</span>
            </div>
          )}
          <div className="divider" />
          <Link className="btn" to="/preflight">
            Full preflight
          </Link>
        </Panel>
      );
    }

    case 'next-leg': {
      if (!ctx.nextLeg) return null;
      const leg = ctx.nextLeg;
      const from = findAirport(leg.from);
      const to = findAirport(leg.to);
      return (
        <Panel title="Next leg">
          <div className="route">
            {from?.iata ?? leg.from} → {to?.iata ?? leg.to}
          </div>
          <div className="small dim" style={{ marginTop: 4 }}>
            {leg.kind === 'deadhead' ? 'Deadhead · ' : ''}
            {leg.flightNumber ? `Flight ${leg.flightNumber} · ` : ''}
            {relative(leg.depart, now)}
          </div>
          <div className="divider" />
          <Stats>
            <Stat k="Off" v={timeIn(leg.depart, from?.tz ?? 'UTC')} sub={from?.iata} />
            <Stat k="On" v={timeIn(leg.arrive, to?.tz ?? 'UTC')} sub={to?.iata} />
            <Stat k="Block" v={formatDuration(leg.blockMinutes ?? minutesBetween(leg.depart, leg.arrive))} />
          </Stats>
        </Panel>
      );
    }

    case 'in-flight': {
      if (!ctx.currentLeg) return null;
      const leg = ctx.currentLeg;
      const from = findAirport(leg.from);
      const to = findAirport(leg.to);
      const total = leg.blockMinutes ?? minutesBetween(leg.depart, leg.arrive) ?? 0;
      const done = minutesBetween(leg.depart, now) ?? 0;
      const pct = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
      return (
        <Panel title="Airborne" className="accent">
          <div className="route magenta-text">
            {from?.iata ?? leg.from} → {to?.iata ?? leg.to}
          </div>
          <div className="bar" style={{ margin: '12px 0 8px' }}>
            <span style={{ width: `${pct}%`, background: 'var(--magenta)' }} />
          </div>
          <div className="small dim">
            {formatDuration(Math.max(0, total - done))} to go · on at{' '}
            <span className="mono">{timeIn(leg.arrive, to?.tz ?? 'UTC')}</span> {to?.iata}
          </div>
          {to && (
            <>
              <div className="divider" />
              <Link className="btn ghost" to={`/deck/airport/${to.icao}`}>
                {to.iata} airport brief
              </Link>
            </>
          )}
        </Panel>
      );
    }

    case 'layover': {
      const lay = ctx.layover ?? ctx.nextLayover;
      if (!lay) return null;
      const active = lay === ctx.layover;
      const remaining = active ? minutesBetween(now, lay.end) ?? 0 : lay.minutes;
      const guide = guideForAirport(lay.airport);
      const budget = layoverBudget(remaining, state.pilot.prefs, lay.hotel?.transitMinutes ?? null);
      const cityTz = findAirport(lay.airport)?.tz ?? 'UTC';
      // A layover that has not started yet is planned around the hour it
      // begins, not the hour it is now.
      const planFrom = active ? now : lay.start;
      const wet = wx.result?.data
        ? (nextSignificantWindow(wx.result.data, planFrom, 6) !== null)
        : false;
      const plan = buildLayoverPlan(guide, budget, {
        hour: hourIn(planFrom, cityTz),
        prefs: state.pilot.prefs,
        feelings: state.placeFeelings,
        wetOutside: wet,
      });

      return (
        <Panel title={active ? `Layover · ${lay.city}` : `Next layover · ${lay.city}`} className={active ? 'accent' : ''}>
          <div className="big">{formatDuration(remaining)}</div>
          <div className="small dim" style={{ marginTop: 4 }}>
            {active ? 'until report' : `starting ${relative(lay.start, now)}`} · {formatDuration(budget.usableMinutes)} usable
            after {formatDuration(budget.sleepMinutes)} sleep and transit
          </div>
          {plan.itinerary.length > 0 && (
            <>
              <div className="divider" />
              {plan.itinerary.map((it) => (
                <div key={it.place.id} className="row" style={{ borderBottom: 0, padding: '7px 0' }}>
                  <span className="mono faint tiny" style={{ width: 46, flex: 'none' }}>
                    +{formatDuration(it.startOffsetMinutes)}
                  </span>
                  <span className="grow small">
                    <span className="strong">{it.place.name}</span>
                    <span className="faint"> · {it.place.why.split('.')[0]}.</span>
                  </span>
                </div>
              ))}
            </>
          )}
          <div className="divider" />
          <Link className="btn primary" to={guide ? `/layover/${guide.key}` : '/layover'}>
            Explore {lay.city}
          </Link>
        </Panel>
      );
    }

    case 'weather': {
      if (!ap) return null;
      const window = wx.result?.data ? nextSignificantWindow(wx.result.data, now, 18) : null;
      return (
        <Panel
          title={`Weather · ${ap.iata}`}
          action={
            <Link className="action" to={`/deck/airport/${ap.icao}`}>
              Detail
            </Link>
          }
        >
          {wx.result?.data?.current && (
            <div className="small">
              <WeatherLine result={wx.result} />
            </div>
          )}
          {window && (
            <div className="small caution-text" style={{ marginTop: 6 }}>
              {window.label} {timeIn(window.start, ap.tz)}–{timeIn(window.end, ap.tz)}
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <WeatherStrip airport={ap} result={wx.result} from={now} />
          </div>
        </Panel>
      );
    }

    case 'trip': {
      if (!ctx.trip) return null;
      const legs = ctx.trip.days.reduce((n, d) => n + d.legs.length, 0);
      const today = ctx.day;
      return (
        <Panel
          title={ctx.trip.number ? `Trip ${ctx.trip.number}` : 'Trip'}
          action={
            <Link className="action" to="/preflight">
              Open
            </Link>
          }
        >
          <Stats>
            <Stat k="Days" v={ctx.trip.days.length} />
            <Stat k="Legs" v={legs} />
            <Stat k="Today" v={formatDuration(today ? dayFlightMinutes(today) : null)} sub="flight time" />
          </Stats>
        </Panel>
      );
    }

    case 'aircraft': {
      const acId = ctx.day?.legs.find((l) => l.aircraftId)?.aircraftId ?? state.pilot.fleet[0];
      if (!acId) return null;
      const tail = ctx.day?.legs.find((l) => l.tail)?.tail;
      return (
        <Panel title="Aircraft">
          <div className="row" style={{ borderBottom: 0, padding: 0 }}>
            <div className="grow">
              <div className="big" style={{ fontSize: 22 }}>
                {aircraftLabel(acId)}
              </div>
              {tail && <div className="small faint mono">{tail}</div>}
            </div>
            <Link className="chip" to={`/deck/aircraft/${acId}`}>
              Profile ›
            </Link>
          </div>
        </Panel>
      );
    }

    case 'airport': {
      const codes = new Set<string>();
      for (const l of ctx.day?.legs ?? []) {
        codes.add(l.from);
        codes.add(l.to);
      }
      const list = [...codes].map((c) => findAirport(c)).filter(Boolean);
      if (list.length === 0) return null;
      return (
        <Panel title="Airports today">
          <div className="chips">
            {list.map((a) => (
              <Link key={a!.icao} className="chip" to={`/deck/airport/${a!.icao}`}>
                {a!.iata}
              </Link>
            ))}
          </div>
        </Panel>
      );
    }

    case 'tomorrow': {
      const nextDay = ctx.trip?.days[ctx.dayIndex + (ctx.state === 'layover' ? 1 : 0)];
      const report = ctx.state === 'layover' ? ctx.layover?.end : nextDay?.reportAt;
      if (!report) return null;
      const tz = findAirport(ctx.layover?.airport ?? ctx.locationIcao)?.tz ?? 'UTC';
      return (
        <Panel title="Tomorrow">
          <div className="big">{timeIn(report, tz)}</div>
          <div className="small dim" style={{ marginTop: 4 }}>
            report · {relative(report, now)}
          </div>
          {nextDay && nextDay.legs.length > 0 && (
            <div className="route" style={{ marginTop: 10, fontSize: 16 }}>
              {routeLine(nextDay)}
            </div>
          )}
        </Panel>
      );
    }

    case 'sleep': {
      const target = ctx.state === 'layover' ? ctx.layover?.end : ctx.reportAt;
      if (!target) return null;
      const prefs = state.pilot.prefs;
      const transit = (ctx.layover?.hotel?.transitMinutes ?? prefs.commuteMinutes) + prefs.airportBufferMinutes;
      const wakeBy = new Date(new Date(target).getTime() - (transit + 45) * 60_000);
      const asleepBy = new Date(wakeBy.getTime() - prefs.sleepTargetMinutes * 60_000);
      const opportunity = minutesBetween(now, wakeBy);
      const tz = findAirport(ctx.locationIcao)?.tz ?? 'UTC';
      return (
        <Panel title="Sleep">
          <Stats>
            <Stat k="Asleep by" v={timeIn(asleepBy, tz)} tone={asleepBy < now ? 'caution' : undefined} />
            <Stat k="Up at" v={timeIn(wakeBy, tz)} />
            <Stat k="Window" v={formatDuration(opportunity)} sub={`target ${formatDuration(prefs.sleepTargetMinutes)}`} />
          </Stats>
          {asleepBy < now && (
            <div className="small caution-text" style={{ marginTop: 8 }}>
              You are already past a full night against your {formatDuration(prefs.sleepTargetMinutes)} target.
            </div>
          )}
        </Panel>
      );
    }

    case 'no-trip':
      return (
        <Panel title="No trip loaded">
          <p className="small dim" style={{ margin: '0 0 12px' }}>
            Paste a pairing and CREW will turn it into a readable trip — report times, legs, layovers, the lot.
          </p>
          <Link className="btn primary" to="/import">
            Make sense of this
          </Link>
        </Panel>
      );

    case 'make-sense':
      return (
        <Panel title="New trip">
          <Link className="btn" to="/import">
            Paste a pairing
          </Link>
        </Panel>
      );

    case 'play': {
      const stats = state.games['guess-aircraft'];
      return (
        <Panel title="Play">
          <div className="row" style={{ borderBottom: 0, padding: 0 }}>
            <div className="grow small dim">
              {stats ? `${stats.correct}/${stats.played} correct · best streak ${stats.bestStreak}` : 'Aircraft, airports, and the numbers behind them.'}
            </div>
            <Link className="chip" to="/play">
              Play ›
            </Link>
          </div>
        </Panel>
      );
    }

    default:
      return null;
  }
}
