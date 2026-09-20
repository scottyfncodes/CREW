import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { formatDuration, instantFromLocal, minutesBetween, shiftDateKey, timeIn } from '../../core/time/time';
import type { LegStatus } from '../../core/types';
import { AIRCRAFT } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { deleteLeg, updateLeg } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Empty, Field, Panel, Stat, Stats } from '../../ui/primitives';

const STATUS_OPTIONS: { value: LegStatus | ''; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'enroute', label: 'En route' },
  { value: 'landed', label: 'Landed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function hhmm(iso: string | null, tz: string): string {
  if (!iso) return '';
  const t = timeIn(iso, tz);
  return t === '—' ? '' : t;
}

/** Correcting a flight already on the schedule — the same fields Add uses, pre-filled. */
export function EditLeg() {
  const { tripId = '', dayId = '', legId = '' } = useParams();
  const navigate = useNavigate();
  const state = useCrew();

  const trip = state.trips.find((t) => t.id === tripId);
  const day = trip?.days.find((d) => d.id === dayId);
  const leg = day?.legs.find((l) => l.id === legId);

  if (!trip || !day || !leg) {
    return (
      <>
        <TopBar title="Edit flight" back />
        <Screen>
          <Empty glyph="◇" title="That flight is not on your schedule anymore">
            <Link to="/schedule">Back to Schedule</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  const legFromAp = findAirport(leg.from);
  const legToAp = findAirport(leg.to);

  const [flightNo, setFlightNo] = useState(leg.flightNumber ?? '');
  const [from, setFrom] = useState(legFromAp?.iata ?? leg.from);
  const [to, setTo] = useState(legToAp?.iata ?? leg.to);
  const [depTime, setDepTime] = useState(hhmm(leg.depart, legFromAp?.tz ?? 'UTC'));
  const [arrTime, setArrTime] = useState(hhmm(leg.arrive, legToAp?.tz ?? 'UTC'));
  const [aircraftId, setAircraftId] = useState(leg.aircraftId ?? '');
  const [tail, setTail] = useState(leg.tail ?? '');
  const [status, setStatus] = useState<LegStatus | ''>(leg.status ?? '');

  const fromAp = findAirport(from);
  const toAp = findAirport(to);
  const dateKey = day.date;

  const computedBlock = (() => {
    if (!fromAp || !toAp || !depTime || !arrTime) return null;
    const d = instantFromLocal(dateKey, depTime, fromAp.tz);
    if (!d) return null;
    let a = instantFromLocal(dateKey, arrTime, toAp.tz);
    if (a && a.getTime() < d.getTime()) a = instantFromLocal(shiftDateKey(dateKey, 1), arrTime, toAp.tz);
    return a ? minutesBetween(d, a) : null;
  })();

  const save = () => {
    if (!fromAp || !toAp) return;
    const d = depTime ? instantFromLocal(dateKey, depTime, fromAp.tz) : null;
    let a = arrTime ? instantFromLocal(dateKey, arrTime, toAp.tz) : null;
    if (d && a && a.getTime() < d.getTime()) a = instantFromLocal(shiftDateKey(dateKey, 1), arrTime, toAp.tz);

    updateLeg(tripId, dayId, legId, {
      flightNumber: flightNo.trim() || null,
      from: fromAp.icao,
      to: toAp.icao,
      depart: d ? d.toISOString() : null,
      arrive: a ? a.toISOString() : null,
      aircraftId: aircraftId || null,
      tail: tail.trim().toUpperCase() || null,
      status: status || null,
      blockMinutes: computedBlock,
    });
    navigate(`/schedule/trip/${tripId}`);
  };

  return (
    <>
      <TopBar title="Edit flight" back />
      <Screen>
        <Panel>
          <Field label="Flight number">
            <input
              type="text"
              value={flightNo}
              autoCapitalize="characters"
              autoCorrect="off"
              onChange={(e) => setFlightNo(e.target.value)}
            />
          </Field>
          <div className="inline-fields">
            <Field label="From">
              <input type="search" value={from} autoCapitalize="characters" autoCorrect="off" onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <input type="search" value={to} autoCapitalize="characters" autoCorrect="off" onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <div className="inline-fields">
            <Field label={`Out${fromAp ? ` · ${fromAp.iata} local` : ''}`}>
              <input type="time" lang="en-GB" value={depTime} onChange={(e) => setDepTime(e.target.value)} />
            </Field>
            <Field label={`In${toAp ? ` · ${toAp.iata} local` : ''}`}>
              <input type="time" lang="en-GB" value={arrTime} onChange={(e) => setArrTime(e.target.value)} />
            </Field>
          </div>
          <Stats>
            <Stat k="Block" v={formatDuration(computedBlock)} tone={computedBlock ? 'accent' : undefined} />
          </Stats>
        </Panel>

        <Panel title="Aircraft & status">
          <div className="inline-fields">
            <Field label="Type">
              <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)}>
                <option value="">Not set</option>
                {AIRCRAFT.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.variant.split(' (')[0]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tail">
              <input type="text" value={tail} autoCapitalize="characters" autoCorrect="off" onChange={(e) => setTail(e.target.value)} />
            </Field>
          </div>
          <Field label="Status" hint="Set this if the flight landed early, was delayed, or was cancelled.">
            <select value={status} onChange={(e) => setStatus(e.target.value as LegStatus | '')}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </Panel>

        <button type="button" className="btn primary" disabled={!fromAp || !toAp} onClick={save}>
          Save changes
        </button>
        <div style={{ height: 10 }} />
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (confirm('Remove this flight from the schedule?')) {
              deleteLeg(tripId, dayId, legId);
              navigate(`/schedule/trip/${tripId}`);
            }
          }}
        >
          Delete this flight
        </button>
      </Screen>
    </>
  );
}
