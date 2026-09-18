import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { dateKeyIn, formatDuration, instantFromLocal, minutesBetween, shiftDateKey, timeIn } from '../../core/time/time';
import { AIRCRAFT } from '../../data/aircraft';
import { findAirport, searchAirports } from '../../data/airportIndex';
import { parseFlightNumber } from '../../data/airlines';
import { lookupFlight, type FieldOrigin, type FlightLookupResult } from '../../services/flightLookup';
import { logFlight } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Advisory, Field, Panel, SourceLinks, Stat, Stats } from '../../ui/primitives';

const ORIGIN_LABEL: Record<FieldOrigin, string> = {
  history: 'your history',
  live: 'live ADS-B',
  schedule: 'schedule',
};

/** Local "HH:MM" for an instant, or empty when unknown. */
function hhmm(iso: string | null, tz: string): string {
  if (!iso) return '';
  const t = timeIn(iso, tz);
  return t === '—' ? '' : t;
}

export function AddFlight() {
  const state = useCrew();
  const navigate = useNavigate();

  const homeTz = findAirport(state.pilot.homeAirport)?.tz ?? 'UTC';
  const today = dateKeyIn(new Date(), homeTz) ?? new Date().toISOString().slice(0, 10);

  const [flightNo, setFlightNo] = useState('');
  const [date, setDate] = useState(today);
  const [looking, setLooking] = useState(false);
  const [result, setResult] = useState<FlightLookupResult | null>(null);

  // The editable form, seeded by the lookup and freely overridable.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [aircraftId, setAircraftId] = useState(state.pilot.fleet[0] ?? 'crj700');
  const [tail, setTail] = useState('');
  const [seat, setSeat] = useState(state.pilot.seat);
  const [note, setNote] = useState('');
  const [blockOverride, setBlockOverride] = useState<string>('');

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

  // Block time follows the times unless the pilot has typed one in.
  const computedBlock = useMemo(() => {
    if (!fromAp || !toAp || !depTime || !arrTime) return null;
    const d = instantFromLocal(date, depTime, fromAp.tz);
    if (!d) return null;
    let a = instantFromLocal(date, arrTime, toAp.tz);
    if (a && a.getTime() < d.getTime()) a = instantFromLocal(shiftDateKey(date, 1), arrTime, toAp.tz);
    return a ? minutesBetween(d, a) : null;
  }, [fromAp, toAp, depTime, arrTime, date]);

  const blockMinutes = blockOverride !== '' ? Number(blockOverride) : computedBlock;

  const applyResult = (r: FlightLookupResult) => {
    if (r.from) setFrom(findAirport(r.from)?.iata ?? r.from);
    if (r.to) setTo(findAirport(r.to)?.iata ?? r.to);
    if (r.depart && r.from) setDepTime(hhmm(r.depart, findAirport(r.from)?.tz ?? 'UTC'));
    if (r.arrive && r.to) setArrTime(hhmm(r.arrive, findAirport(r.to)?.tz ?? 'UTC'));
    if (r.aircraftId) setAircraftId(r.aircraftId);
    if (r.tail) setTail(r.tail);
    setBlockOverride('');
  };

  const runLookup = async (numberOverride?: string) => {
    const input = numberOverride ?? flightNo;
    if (!parseFlightNumber(input)) return;
    setLooking(true);
    try {
      const r = await lookupFlight(input, date, state, { today });
      setResult(r);
      if (r) applyResult(r);
    } finally {
      setLooking(false);
    }
  };

  // Re-run the lookup when the date changes and a number is already entered.
  // Deliberately keyed on the date alone: re-running on every keystroke of
  // the flight number would fire a request per character.
  useEffect(() => {
    if (result && flightNo) void runLookup();
     
  }, [date]);

  const canSave = Boolean(fromAp && toAp && blockMinutes !== null && blockMinutes > 0);

  const save = () => {
    if (!canSave || !fromAp || !toAp) return;
    logFlight({
      date,
      from: fromAp.icao,
      to: toAp.icao,
      aircraftId,
      tail: tail.trim().toUpperCase() || undefined,
      blockMinutes: blockMinutes!,
      seat,
      note: note.trim() || undefined,
    });
    navigate('/play/history');
  };

  return (
    <>
      <TopBar title="Add a flight" back />
      <Screen>
        <Panel className="accent">
          <div className="inline-fields">
            <Field label="Flight number">
              <input
                type="text"
                inputMode="numeric"
                value={flightNo}
                placeholder="5142"
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(e) => setFlightNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runLookup();
                }}
              />
            </Field>
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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

        {result && (
          <Panel title="What CREW found">
            {Object.keys(result.origin).length > 0 ? (
              <div className="chips" style={{ marginBottom: 10 }}>
                {(['from', 'to', 'depart', 'arrive', 'aircraftId', 'tail'] as const)
                  .filter((f) => result.origin[f])
                  .map((f) => (
                    <span key={f} className="chip go">
                      {fieldLabel(f)} · {ORIGIN_LABEL[result.origin[f]!]}
                    </span>
                  ))}
              </div>
            ) : (
              <div className="small faint" style={{ marginBottom: 8 }}>
                Nothing matched — everything below is yours to fill in.
              </div>
            )}
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
            <AirportField label="From" value={from} onChange={setFrom} />
            <AirportField label="To" value={to} onChange={setTo} />
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
            <Stat
              k="Block"
              v={formatDuration(blockMinutes)}
              sub={blockOverride !== '' ? 'entered' : 'from the times'}
              tone={blockMinutes && blockMinutes > 0 ? 'accent' : undefined}
            />
            <Stat k="Decimal" v={blockMinutes ? (blockMinutes / 60).toFixed(1) : '—'} sub="hours" />
          </Stats>
          <Field label="Override block (minutes)" hint="Leave empty to use out and in times.">
            <input
              type="number"
              inputMode="numeric"
              value={blockOverride}
              placeholder={computedBlock !== null ? String(computedBlock) : ''}
              onChange={(e) => setBlockOverride(e.target.value)}
            />
          </Field>
        </Panel>

        <Panel title="Aircraft">
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
          <Field label="Seat">
            <select value={seat} onChange={(e) => setSeat(e.target.value as 'FO' | 'CA')}>
              <option value="FO">First Officer</option>
              <option value="CA">Captain</option>
            </select>
          </Field>
          <Field label="Note">
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </Field>
        </Panel>

        <button type="button" className="btn primary" disabled={!canSave} onClick={save}>
          {canSave
            ? `Log ${fromAp!.iata} → ${toAp!.iata} · ${formatDuration(blockMinutes)}`
            : 'Fill in both airports and the times'}
        </button>
        <div style={{ height: 10 }} />

        {!state.integrations.aeroDataBoxKey && (
          <Advisory>
            Without a schedule key CREW can only fill in flights you have flown before, plus anything airborne right
            now. Add an AeroDataBox key in Settings to look up any flight on any date.
          </Advisory>
        )}
      </Screen>
    </>
  );
}

function fieldLabel(f: string): string {
  switch (f) {
    case 'from':
      return 'Origin';
    case 'to':
      return 'Destination';
    case 'depart':
      return 'Out';
    case 'arrive':
      return 'In';
    case 'aircraftId':
      return 'Type';
    case 'tail':
      return 'Tail';
    default:
      return f;
  }
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
