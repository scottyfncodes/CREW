import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { legIsLogged } from '../../core/context/schedule';
import { legBlockMinutes } from '../../core/context/trip';
import { dateKeyIn, formatDuration, minutesBetween, timeIn } from '../../core/time/time';
import { AIRCRAFT } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { logFlight } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Empty, Field, Panel, Stat, Stats } from '../../ui/primitives';

/**
 * FLIGHT COMPLETE -> REVIEW FOR LOGBOOK -> confirm/edit -> SAVE.
 *
 * Everything is pre-filled from the schedule leg the pilot actually flew;
 * this screen exists so a correction (a real tail swap, a block time that
 * needs adjusting) happens once, deliberately, not silently.
 */
export function ReviewFlight() {
  const { tripId = '', dayId = '', legId = '' } = useParams();
  const navigate = useNavigate();
  const state = useCrew();

  const trip = state.trips.find((t) => t.id === tripId);
  const day = trip?.days.find((d) => d.id === dayId);
  const leg = day?.legs.find((l) => l.id === legId);
  const alreadyLogged = leg ? legIsLogged(leg.id, state.flights) : false;

  const fromAp = findAirport(leg?.from);
  const toAp = findAirport(leg?.to);

  const [date, setDate] = useState(() => {
    if (!leg?.depart) return day?.date ?? '';
    return dateKeyIn(leg.depart, fromAp?.tz ?? 'UTC') ?? day?.date ?? '';
  });
  const [blockMinutes, setBlockMinutes] = useState(() => (leg ? legBlockMinutes(leg) ?? 0 : 0));
  const [tail, setTail] = useState(leg?.tail ?? '');
  const [aircraftId, setAircraftId] = useState(leg?.aircraftId ?? state.pilot.fleet[0] ?? 'crj700');
  const [seat, setSeat] = useState(state.pilot.seat);
  const [note, setNote] = useState('');

  if (!trip || !day || !leg) {
    return (
      <>
        <TopBar title="Review flight" back />
        <Screen>
          <Empty glyph="◇" title="That flight is not on your schedule anymore">
            <Link to="/logbook">Back to Logbook</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  if (alreadyLogged) {
    return (
      <>
        <TopBar title="Review flight" back />
        <Screen>
          <Empty glyph="✓" title="Already in your logbook">
            <Link to="/logbook">Open your logbook</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  const save = () => {
    if (!fromAp || !toAp || blockMinutes <= 0) return;
    logFlight({
      date,
      from: fromAp.icao,
      to: toAp.icao,
      aircraftId,
      tail: tail.trim().toUpperCase() || undefined,
      blockMinutes,
      seat,
      note: note.trim() || undefined,
      sourceLegId: leg.id,
    });
    navigate('/logbook');
  };

  return (
    <>
      <TopBar title="Review for logbook" back />
      <Screen>
        <Panel title="Flight complete" className="accent">
          <div className="route" style={{ fontSize: 22 }}>
            {fromAp?.iata ?? leg.from} → {toAp?.iata ?? leg.to}
          </div>
          <div className="small dim" style={{ marginTop: 4 }}>
            {leg.flightNumber ? `Flight ${leg.flightNumber} · ` : ''}
            {leg.depart && leg.arrive ? `${timeIn(leg.depart, fromAp?.tz ?? 'UTC')} → ${timeIn(leg.arrive, toAp?.tz ?? 'UTC')}` : 'Times not published'}
          </div>
          <p className="small dim" style={{ margin: '10px 0 0' }}>
            Confirm this is right, or correct anything before it becomes a permanent logbook entry.
          </p>
        </Panel>

        <Panel title="For the logbook">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="inline-fields">
            <Field label="Type">
              <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)}>
                {AIRCRAFT.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.variant.split(' (')[0]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tail">
              <input
                type="text"
                value={tail}
                placeholder="N705PS"
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(e) => setTail(e.target.value)}
              />
            </Field>
          </div>
          <div className="inline-fields">
            <Field label="Block minutes">
              <input
                type="number"
                inputMode="numeric"
                value={blockMinutes || ''}
                onChange={(e) => setBlockMinutes(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Seat">
              <select value={seat} onChange={(e) => setSeat(e.target.value as 'FO' | 'CA')}>
                <option value="FO">First Officer</option>
                <option value="CA">Captain</option>
              </select>
            </Field>
          </div>
          <Stats>
            <Stat k="Block" v={formatDuration(blockMinutes)} tone="accent" />
            <Stat k="Decimal" v={blockMinutes ? (blockMinutes / 60).toFixed(1) : '—'} sub="hours" />
            <Stat
              k="Scheduled"
              v={formatDuration(leg.blockMinutes ?? minutesBetween(leg.depart, leg.arrive))}
              sub="as flown"
            />
          </Stats>
          <Field label="Note">
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </Panel>

        <button type="button" className="btn primary" disabled={!fromAp || !toAp || blockMinutes <= 0} onClick={save}>
          Save to logbook
        </button>
      </Screen>
    </>
  );
}
