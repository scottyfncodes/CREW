import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { dateIn, dateKeyIn, formatDuration, instantFromLocal, minutesBetween, shiftDateKey, timeIn } from '../../core/time/time';
import type { LegStatus } from '../../core/types';
import { AIRCRAFT, aircraftLabel } from '../../data/aircraft';
import { findAirport, searchAirports } from '../../data/airportIndex';
import { parseFlightNumber } from '../../data/airlines';
import { lookupFlight, type FieldOrigin, type FlightLookupResult } from '../../services/flightLookup';
import { addFlightToSchedule } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Advisory, Field, Panel, SourceLinks, Stat, Stats } from '../../ui/primitives';

/**
 * The whole point of this screen: a flight number and a date go in, a
 * confirmable flight comes out. CREW does the tedious part — the pilot
 * confirms or corrects, never re-types a schedule it can look up itself.
 */

type Provenance = FieldOrigin | 'user' | null;

const PROVENANCE_LABEL: Record<Exclude<Provenance, null>, string> = {
  history: 'your history',
  live: 'live now',
  schedule: 'imported',
  user: 'entered',
};

const STATUS_LABEL: Record<LegStatus, string> = {
  scheduled: 'Scheduled',
  enroute: 'En route',
  landed: 'Landed',
  cancelled: 'Cancelled',
};

/** Local "HH:MM" for an instant, or empty when unknown. */
function hhmm(iso: string | null, tz: string): string {
  if (!iso) return '';
  const t = timeIn(iso, tz);
  return t === '—' ? '' : t;
}

export function AddToSchedule() {
  const state = useCrew();
  const navigate = useNavigate();

  const homeTz = findAirport(state.pilot.homeAirport)?.tz ?? 'UTC';
  const today = dateKeyIn(new Date(), homeTz) ?? new Date().toISOString().slice(0, 10);

  const [flightNo, setFlightNo] = useState('');
  const [date, setDate] = useState(today);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<FlightLookupResult | null>(null);
  const [checked, setChecked] = useState(false); // a lookup has actually run
  const [editing, setEditing] = useState(false);

  // The confirmable/editable flight. Seeded from the lookup; any field the
  // pilot touches is remembered as theirs, not the provider's.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [aircraftId, setAircraftId] = useState(state.pilot.fleet[0] ?? 'crj700');
  const [tail, setTail] = useState('');
  const [status, setStatus] = useState<LegStatus | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  /** Flight numbers already in the pilot's trips, newest first. */
  const recentNumbers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const trip of state.trips) {
      for (const day of trip.days) {
        for (const leg of day.legs) {
          if (!leg.flightNumber) continue;
          const n = leg.flightNumber.replace(/\D/g, '');
          if (n && !seen.has(n)) {
            const f = findAirport(leg.from)?.iata ?? leg.from;
            const t = findAirport(leg.to)?.iata ?? leg.to;
            seen.set(n, `${f}–${t}`);
          }
        }
      }
    }
    return [...seen.entries()].slice(0, 8);
  }, [state.trips]);

  const fromAp = findAirport(from);
  const toAp = findAirport(to);

  const computedBlock = useMemo(() => {
    if (!fromAp || !toAp || !depTime || !arrTime) return null;
    const d = instantFromLocal(date, depTime, fromAp.tz);
    if (!d) return null;
    let a = instantFromLocal(date, arrTime, toAp.tz);
    if (a && a.getTime() < d.getTime()) a = instantFromLocal(shiftDateKey(date, 1), arrTime, toAp.tz);
    return a ? minutesBetween(d, a) : null;
  }, [fromAp, toAp, depTime, arrTime, date]);

  const blockMinutes = result?.blockMinutes && !touched.has('depTime') && !touched.has('arrTime')
    ? result.blockMinutes
    : computedBlock;

  const provenance = (field: string): Provenance => {
    if (touched.has(field)) return 'user';
    const key = field as keyof FlightLookupResult;
    return result?.origin[key] ?? null;
  };

  const touch = (field: string) => setTouched((prev) => new Set(prev).add(field));

  const applyResult = (r: FlightLookupResult) => {
    setTouched(new Set());
    if (r.from) setFrom(findAirport(r.from)?.iata ?? r.from);
    if (r.to) setTo(findAirport(r.to)?.iata ?? r.to);
    if (r.depart && r.from) setDepTime(hhmm(r.depart, findAirport(r.from)?.tz ?? 'UTC'));
    if (r.arrive && r.to) setArrTime(hhmm(r.arrive, findAirport(r.to)?.tz ?? 'UTC'));
    if (r.aircraftId) setAircraftId(r.aircraftId);
    if (r.tail) setTail(r.tail);
    setStatus(r.status);
    const foundNothing = Object.keys(r.origin).length === 0;
    setEditing(foundNothing);
  };

  const runLookup = async (numberOverride?: string) => {
    const input = numberOverride ?? flightNo;
    if (!parseFlightNumber(input)) return;
    setLooking(true);
    try {
      const r = await lookupFlight(input, date, state, { today });
      setResult(r);
      setChecked(true);
      if (r) applyResult(r);
      else setEditing(true);
    } finally {
      setLooking(false);
    }
  };

  const canAdd = Boolean(fromAp && toAp);

  const add = () => {
    if (!canAdd || !fromAp || !toAp) return;
    const dep = depTime ? instantFromLocal(date, depTime, fromAp.tz) : null;
    let arr = arrTime ? instantFromLocal(date, arrTime, toAp.tz) : null;
    if (dep && arr && arr.getTime() < dep.getTime()) arr = instantFromLocal(shiftDateKey(date, 1), arrTime, toAp.tz);

    const { tripId } = addFlightToSchedule(date, {
      kind: 'flight',
      flightNumber: flightNo.replace(/\D/g, '') || null,
      from: fromAp.icao,
      to: toAp.icao,
      depart: dep ? dep.toISOString() : null,
      arrive: arr ? arr.toISOString() : null,
      aircraftId: aircraftId || null,
      tail: tail.trim().toUpperCase() || null,
      blockMinutes: blockMinutes ?? null,
    });
    navigate(`/schedule/trip/${tripId}`);
  };

  return (
    <>
      <TopBar title="Add flight" back />
      <Screen>
        <Panel className="accent">
          <div className="inline-fields">
            <Field label="Flight number">
              <input
                type="text"
                inputMode="numeric"
                value={flightNo}
                placeholder="UA1234"
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(e) => {
                  setFlightNo(e.target.value);
                  setChecked(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runLookup();
                }}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setChecked(false);
                }}
              />
            </Field>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={looking || !parseFlightNumber(flightNo)}
            onClick={() => void runLookup()}
          >
            {looking ? 'Looking…' : 'Look it up'}
          </button>

          {recentNumbers.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '14px 0 6px' }}>
                Flights you have flown
              </div>
              <div className="scroller">
                {recentNumbers.map(([n, route]) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip ${flightNo.replace(/\D/g, '') === n ? 'on' : ''}`}
                    onClick={() => {
                      setFlightNo(n);
                      void runLookup(n);
                    }}
                  >
                    {n} <span className="faint">{route}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Panel>

        {checked && !editing && (
          <ConfirmCard
            flightNo={flightNo}
            date={date}
            fromAp={fromAp}
            toAp={toAp}
            depTime={depTime}
            arrTime={arrTime}
            aircraftId={aircraftId}
            tail={tail}
            status={status}
            blockMinutes={blockMinutes}
            provenance={provenance}
            sources={result?.sources ?? []}
            notes={result?.notes ?? []}
            onEdit={() => setEditing(true)}
            onAdd={add}
          />
        )}

        {checked && editing && (
          <>
            {result && result.notes.length > 0 && (
              <Panel title="What CREW found">
                {result.notes.map((n) => (
                  <p key={n} className="small dim" style={{ margin: '0 0 8px' }}>
                    {n}
                  </p>
                ))}
                {result.sources.length > 0 && <SourceLinks sources={result.sources} />}
              </Panel>
            )}

            <Panel title="The flight">
              <div className="inline-fields">
                <AirportField label="From" value={from} onChange={(v) => { setFrom(v); touch('from'); }} />
                <AirportField label="To" value={to} onChange={(v) => { setTo(v); touch('to'); }} />
              </div>
              <div className="inline-fields">
                <Field label={`Out${fromAp ? ` · ${fromAp.iata} local` : ''}`}>
                  <input
                    type="time"
                    lang="en-GB"
                    value={depTime}
                    onChange={(e) => { setDepTime(e.target.value); touch('depTime'); }}
                  />
                </Field>
                <Field label={`In${toAp ? ` · ${toAp.iata} local` : ''}`}>
                  <input
                    type="time"
                    lang="en-GB"
                    value={arrTime}
                    onChange={(e) => { setArrTime(e.target.value); touch('arrTime'); }}
                  />
                </Field>
              </div>
              <Stats>
                <Stat k="Block" v={formatDuration(blockMinutes)} tone={blockMinutes ? 'accent' : undefined} />
                <Stat k="Decimal" v={blockMinutes ? (blockMinutes / 60).toFixed(1) : '—'} sub="hours" />
              </Stats>
            </Panel>

            <Panel title="Aircraft">
              <div className="inline-fields">
                <Field label="Type">
                  <select value={aircraftId} onChange={(e) => { setAircraftId(e.target.value); touch('aircraftId'); }}>
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
                    onChange={(e) => { setTail(e.target.value); touch('tail'); }}
                  />
                </Field>
              </div>
            </Panel>

            <button type="button" className="btn primary" disabled={!canAdd} onClick={add}>
              {canAdd ? `Add ${fromAp!.iata} → ${toAp!.iata} to schedule` : 'Fill in both airports'}
            </button>
            <div style={{ height: 10 }} />
          </>
        )}

        {!state.integrations.aeroDataBoxKey && (
          <Advisory>
            Without a schedule key CREW can only fill in flights you have flown before, plus anything airborne right
            now. Add an AeroDataBox key in Tools → Settings to look up any flight on any date.
          </Advisory>
        )}
      </Screen>
    </>
  );
}

function ConfirmCard({
  flightNo,
  date,
  fromAp,
  toAp,
  depTime,
  arrTime,
  aircraftId,
  tail,
  status,
  blockMinutes,
  provenance,
  sources,
  notes,
  onEdit,
  onAdd,
}: {
  flightNo: string;
  date: string;
  fromAp: ReturnType<typeof findAirport>;
  toAp: ReturnType<typeof findAirport>;
  depTime: string;
  arrTime: string;
  aircraftId: string;
  tail: string;
  status: LegStatus | null;
  blockMinutes: number | null;
  provenance: (field: string) => Provenance;
  sources: FlightLookupResult['sources'];
  notes: string[];
  onEdit: () => void;
  onAdd: () => void;
}) {
  const canAdd = Boolean(fromAp && toAp);

  const Badge = ({ field }: { field: string }) => {
    const p = provenance(field);
    if (!p) return <span className="chip faint">Unavailable</span>;
    return <span className="chip go">{PROVENANCE_LABEL[p]}</span>;
  };

  return (
    <Panel title="Add to schedule?" className="accent">
      <div className="big" style={{ fontSize: 22 }}>
        {flightNo || '—'}
      </div>
      <div className="route" style={{ marginTop: 6 }}>
        {fromAp?.iata ?? '—'} → {toAp?.iata ?? '—'}
      </div>
      <div className="small dim" style={{ marginTop: 4 }}>
        {dateIn(`${date}T12:00:00Z`, fromAp?.tz ?? 'UTC')}
        {status && <span className="chip caution" style={{ marginLeft: 8, padding: '1px 7px' }}>{STATUS_LABEL[status]}</span>}
      </div>

      <div className="divider" />

      <Stats>
        <Stat k="Out" v={depTime || '—'} sub={fromAp?.iata} />
        <Stat k="In" v={arrTime || '—'} sub={toAp?.iata} />
        <Stat k="Block" v={formatDuration(blockMinutes)} />
      </Stats>

      <div className="chips" style={{ marginTop: 12 }}>
        <Badge field="from" />
        <Badge field="depTime" />
        <Badge field="arrTime" />
      </div>

      <div className="divider" />

      <div className="row" style={{ borderBottom: 0, padding: '0 0 10px' }}>
        <div className="grow">
          <div className="strong">{aircraftLabel(aircraftId)}</div>
          {tail && <div className="small faint mono">{tail}</div>}
        </div>
        <Badge field="aircraftId" />
      </div>

      {notes.map((n) => (
        <p key={n} className="tiny faint" style={{ margin: '0 0 6px' }}>
          {n}
        </p>
      ))}
      {sources.length > 0 && <SourceLinks sources={sources} />}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn ghost" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn primary" disabled={!canAdd} onClick={onAdd}>
          Add to schedule
        </button>
      </div>
    </Panel>
  );
}

function AirportField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const resolved = findAirport(value);
  const matches = focused && value.trim() && !resolved ? searchAirports(value, 4) : [];

  return (
    <Field label={label} hint={resolved ? resolved.city : undefined}>
      <input
        type="search"
        value={value}
        placeholder="CLT"
        autoCapitalize="characters"
        autoCorrect="off"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => onChange(e.target.value)}
      />
      {matches.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {matches.map((a) => (
            <button
              key={a.icao}
              type="button"
              className="row"
              style={{ padding: '7px 0' }}
              onClick={() => onChange(a.iata)}
            >
              <span className="mono strong" style={{ width: 42, flex: 'none' }}>
                {a.iata}
              </span>
              <span className="grow tiny">{a.city}</span>
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
