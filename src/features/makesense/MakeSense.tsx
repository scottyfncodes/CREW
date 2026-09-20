import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { parseSchedule, type ParseResult } from '../../core/parse/schedule';
import { routeLine, timeAwayMinutes, tripFlightMinutes, tripLegCount } from '../../core/context/trip';
import { dateIn, formatDuration, formatHoursDecimal, timeIn } from '../../core/time/time';
import { findAirport } from '../../data/airportIndex';
import { addTrip } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Advisory, Field, Panel, Stat, Stats } from '../../ui/primitives';

const EXAMPLE = `TRIP 4412
DAY 1  18SEP
RPT 0515
5142  DAY CLT  0600 0721
5388  CLT DCA  0815 0932
5401  DCA CLT  1025 1156
REL 1211
HOTEL  Uptown Charlotte  704-555-0142

DAY 2  19SEP
RPT 0550
5217  CLT RIC  0635 0744
5230  RIC CLT  0830 0952
5119  CLT DAY  1105 1231
REL 1246`;

export function MakeSense() {
  const navigate = useNavigate();
  const state = useCrew();
  const [text, setText] = useState('');
  const [anchor, setAnchor] = useState('');

  const homeTz = findAirport(state.pilot.homeAirport)?.tz;

  const result: ParseResult | null = useMemo(() => {
    if (!text.trim()) return null;
    return parseSchedule(text, {
      anchorDate: anchor || undefined,
      anchorTz: homeTz,
    });
  }, [text, anchor, homeTz]);

  return (
    <>
      <TopBar title="Paste a pairing" back />
      <Screen>
        <Panel>
          <p className="small dim" style={{ margin: '0 0 12px' }}>
            Paste a pairing, a trip sheet, a text message from scheduling — whatever form it arrives in. CREW reads what
            it recognises and tells you plainly what it could not.
          </p>
          <Field label="Schedule text">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'5142  DAY CLT  0600 0721\n5388  CLT DCA  0815 0932'}
              spellCheck={false}
              autoCapitalize="characters"
            />
          </Field>
          <div className="banner" style={{ marginBottom: 12 }}>
            <span className="grow">Just one flight? <Link to="/schedule/add">Add it by flight number</Link> instead.</span>
          </div>
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={() => setText(EXAMPLE)}>
              Use an example
            </button>
            <button type="button" className="btn ghost" onClick={() => setText('')} disabled={!text}>
              Clear
            </button>
          </div>
        </Panel>

        <Panel title="If the text has no dates">
          <Field label="Anchor the first duty day to" hint="Leave blank to use today. CREW says so on the result when it has to assume.">
            <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </Field>
        </Panel>

        {result && <ParseOutput result={result} onAccept={(t) => { addTrip(t); navigate(`/schedule/trip/${t.id}`); }} />}

        <Advisory>
          CREW only restates what your text contained. It does not fetch, verify or complete your schedule — your
          company's system remains the authority on report times, releases and changes.
        </Advisory>
      </Screen>
    </>
  );
}

function ParseOutput({ result, onAccept }: { result: ParseResult; onAccept: (trip: NonNullable<ParseResult['trip']>) => void }) {
  const trip = result.trip;

  if (!trip) {
    return (
      <Panel title="Nothing recognised" className="caution">
        <p className="small dim" style={{ margin: 0 }}>
          CREW could not find a leg in that text. It looks for two airport codes followed by two times on a line, for
          example <span className="mono">5142 DAY CLT 0600 0721</span>.
        </p>
        {result.issues.length > 0 && (
          <>
            <div className="divider" />
            <div className="tiny faint">Lines it skipped:</div>
            {result.issues.slice(0, 8).map((i) => (
              <div key={i.line} className="tiny mono faint" style={{ marginTop: 3 }}>
                {i.line}: {i.text.slice(0, 60)}
              </div>
            ))}
          </>
        )}
      </Panel>
    );
  }

  return (
    <>
      <Panel title="What CREW read" className="accent">
        <Stats>
          <Stat k="Days" v={trip.days.length} />
          <Stat k="Legs" v={tripLegCount(trip)} />
          <Stat k="Flight" v={formatHoursDecimal(tripFlightMinutes(trip))} sub="hours" />
          <Stat k="Away" v={formatDuration(timeAwayMinutes(trip))} sub="TAFB" />
        </Stats>

        <div className="divider" />

        {trip.days.map((d, i) => {
          const tz = findAirport(d.legs[0]?.from)?.tz ?? 'UTC';
          return (
            <div key={d.id} style={{ marginBottom: 14 }}>
              <div className="eyebrow" style={{ margin: '0 0 4px' }}>
                Day {i + 1} · {dateIn(d.reportAt ?? d.legs[0]?.depart ?? `${d.date}T12:00:00Z`, tz)}
              </div>
              <div className="route" style={{ fontSize: 17 }}>
                {routeLine(d)}
              </div>
              <div className="small mono faint" style={{ marginTop: 4 }}>
                Report {d.reportAt ? timeIn(d.reportAt, tz) : <span className="caution-text">not in the text</span>} · Release{' '}
                {d.releaseAt ? (
                  timeIn(d.releaseAt, findAirport(d.legs[d.legs.length - 1]?.to)?.tz ?? tz)
                ) : (
                  <span className="caution-text">not in the text</span>
                )}
              </div>
              {d.hotel && <div className="tiny faint" style={{ marginTop: 3 }}>Hotel: {d.hotel.name}</div>}
            </div>
          );
        })}

        <button type="button" className="btn primary" onClick={() => onAccept(trip)}>
          Use this trip
        </button>
      </Panel>

      {result.assumptions.length > 0 && (
        <Panel title="Assumptions" className="caution">
          {result.assumptions.map((a) => (
            <div key={a} className="small caution-text">
              {a}
            </div>
          ))}
        </Panel>
      )}

      <Panel title={`Lines read: ${result.recognizedLines} of ${result.totalLines}`}>
        {result.issues.length === 0 ? (
          <div className="small go">Everything in that text was understood.</div>
        ) : (
          <>
            <div className="small dim" style={{ marginBottom: 8 }}>
              Skipped — nothing from these lines was used, and no values were guessed from them.
            </div>
            {result.issues.slice(0, 12).map((i, n) => (
              <div key={`${i.line}-${n}`} className="tiny mono faint" style={{ marginTop: 3 }}>
                {i.line > 0 ? `${i.line}: ` : ''}
                {i.text.slice(0, 70)} <span style={{ color: 'var(--text-faint)' }}>— {i.reason}</span>
              </div>
            ))}
          </>
        )}
      </Panel>
    </>
  );
}
