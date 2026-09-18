import { Fragment, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { formatDuration } from '../../core/time/time';
import type { AircraftSpec } from '../../core/types';
import { AIRCRAFT, findAircraft } from '../../data/aircraft';
import { fleetFromLog } from '../../core/context/stats';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Panel, SourceLinks, Stat, Stats } from '../../ui/primitives';

export function AircraftList() {
  const state = useCrew();
  const mine = new Set(state.pilot.fleet);
  const sorted = [...AIRCRAFT].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));

  return (
    <>
      <TopBar title="Aircraft" back action={<Link className="chip" to="/deck/compare">Compare</Link>} />
      <Screen>
        <Panel className="flush">
          <div className="list inset">
            {sorted.map((a) => (
              <Link key={a.id} className="row" to={`/deck/aircraft/${a.id}`}>
                <div className="grow">
                  <div className="strong">
                    {a.variant.split(' (')[0]}
                    {mine.has(a.id) && <span className="chip go" style={{ marginLeft: 8, padding: '1px 7px' }}>Yours</span>}
                  </div>
                  <div className="tiny faint mono">
                    {a.manufacturer} · {a.icaoType} · {a.seats.typical} seats · {a.engines.model}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        </Panel>
        <Advisory>
          Published figures for a representative build of each variant. The AFM and your company's performance data
          govern anything you actually fly.
        </Advisory>
      </Screen>
    </>
  );
}

export function AircraftProfile() {
  const { id = '' } = useParams();
  const ac = findAircraft(id);
  const state = useCrew();

  const myTails = useMemo(
    () => fleetFromLog(state.flights, state.tails).filter((t) => t.aircraftId === id),
    [state.flights, state.tails, id],
  );

  if (!ac) {
    return (
      <>
        <TopBar title="Aircraft" back />
        <Screen>
          <Empty glyph="✈" title="Not in CREW's aircraft set">
            <Link to="/deck/aircraft">Browse the aircraft CREW carries</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  const e = ac.engines;
  const p = ac.performance;
  const w = ac.weights;
  const d = ac.dimensions;

  return (
    <>
      <TopBar title={ac.variant.split(' (')[0]} back action={<Link className="chip" to={`/deck/compare?a=${ac.id}`}>Compare</Link>} />
      <Screen>
        <div style={{ padding: '4px 0 14px' }}>
          <div className="big" style={{ fontSize: 24 }}>
            {ac.manufacturer} {ac.variant}
          </div>
          <div className="small dim mono">
            {ac.icaoType} · {e.count}× {e.manufacturer} {e.model}
          </div>
        </div>

        <Stats>
          <Stat k="Seats" v={ac.seats.typical} sub={ac.seats.max ? `max ${ac.seats.max}` : undefined} />
          <Stat k="Range" v={p.rangeNm.toLocaleString()} sub="nm" />
          <Stat k="Ceiling" v={p.ceilingFt.toLocaleString()} sub="ft" />
          <Stat k="MTOW" v={Math.round(w.mtowLb / 1000)} sub="×1000 lb" />
        </Stats>

        <Panel title="Powerplant">
          <Stats>
            <Stat k="Thrust" v={e.thrustLbf ? e.thrustLbf.toLocaleString() : '—'} sub="lbf each" />
            <Stat k="Bypass" v={e.bypassRatio ? `${e.bypassRatio}:1` : '—'} />
            <Stat k="Type" v={<span className="v sm">{e.type}</span>} />
          </Stats>
          <div className="small dim" style={{ marginTop: 10 }}>
            {e.count}× {e.manufacturer} {e.model}
            {e.thrustLbf ? ` — ${(e.thrustLbf * e.count).toLocaleString()} lbf total` : ''}
          </div>
        </Panel>

        <Panel title="Speeds">
          <Stats>
            <Stat k="Cruise" v={p.cruiseMach ? `M${p.cruiseMach.toFixed(2)}` : '—'} sub={p.cruiseKtas ? `${p.cruiseKtas} ktas` : undefined} />
            <Stat k="MMO" v={p.mmo ? `M${p.mmo.toFixed(2)}` : '—'} />
            <Stat k="VMO" v={p.vmo ? `${p.vmo}` : '—'} sub="kias" />
            <Stat k="TO field" v={p.takeoffFieldFt ? p.takeoffFieldFt.toLocaleString() : '—'} sub="ft, MTOW/SL/ISA" />
          </Stats>
        </Panel>

        <Panel title="Weights & fuel">
          <Stats>
            <Stat k="MTOW" v={w.mtowLb.toLocaleString()} sub="lb" />
            <Stat k="MLW" v={w.mlwLb ? w.mlwLb.toLocaleString() : '—'} sub="lb" />
            <Stat k="OEW" v={w.oewLb ? w.oewLb.toLocaleString() : '—'} sub="lb" />
            <Stat k="Fuel" v={w.fuelCapacityLb.toLocaleString()} sub="lb" />
          </Stats>
          {w.oewLb && (
            <div className="small dim" style={{ marginTop: 10 }}>
              Useful load at MTOW:{' '}
              <span className="mono strong">{(w.mtowLb - w.oewLb).toLocaleString()} lb</span>
              <span className="faint"> — payload and fuel together, before any operational limit.</span>
            </div>
          )}
        </Panel>

        <Panel title="Dimensions">
          <Stats>
            <Stat k="Length" v={d.lengthFt.toFixed(1)} sub="ft" />
            <Stat k="Span" v={d.wingspanFt.toFixed(1)} sub="ft" />
            <Stat k="Height" v={d.heightFt.toFixed(1)} sub="ft" />
            {d.wingAreaSqFt && <Stat k="Wing area" v={d.wingAreaSqFt.toLocaleString()} sub="sq ft" />}
          </Stats>
          {d.wingAreaSqFt && (
            <div className="small dim" style={{ marginTop: 10 }}>
              Wing loading at MTOW:{' '}
              <span className="mono strong">{(w.mtowLb / d.wingAreaSqFt).toFixed(0)} lb/sq ft</span>
            </div>
          )}
        </Panel>

        <Panel title="Why it is the way it is">
          {ac.engineering.map((line) => (
            <p key={line} className="small dim" style={{ margin: '0 0 10px' }}>
              {line}
            </p>
          ))}
        </Panel>

        <Panel title="History">
          {ac.history.map((line) => (
            <p key={line} className="small dim" style={{ margin: '0 0 10px' }}>
              {line}
            </p>
          ))}
          <SourceLinks sources={ac.sources} />
        </Panel>

        {myTails.length > 0 && (
          <Panel title="Your airframes">
            {myTails.map((t) => (
              <div key={t.tail} className="row">
                <span className="mono strong" style={{ width: 74, flex: 'none' }}>
                  {t.tail}
                </span>
                <div className="grow small">
                  <span className="mono">{t.flights} flights</span>
                  <span className="faint mono"> · {formatDuration(t.blockMinutes)}</span>
                  {t.last && <div className="tiny faint">last flown {t.last}</div>}
                </div>
              </div>
            ))}
          </Panel>
        )}

        <Advisory>
          These are published reference figures for the type, not limitations for the aeroplane in front of you.
        </Advisory>
      </Screen>
    </>
  );
}

const ROWS: { label: string; get: (a: AircraftSpec) => number | null; unit?: string; higherIsBetter?: boolean }[] = [
  { label: 'Seats (typical)', get: (a) => a.seats.typical, higherIsBetter: true },
  { label: 'Range', get: (a) => a.performance.rangeNm, unit: 'nm', higherIsBetter: true },
  { label: 'Ceiling', get: (a) => a.performance.ceilingFt, unit: 'ft', higherIsBetter: true },
  { label: 'MMO', get: (a) => a.performance.mmo ?? null, higherIsBetter: true },
  { label: 'Thrust / engine', get: (a) => a.engines.thrustLbf ?? null, unit: 'lbf', higherIsBetter: true },
  { label: 'MTOW', get: (a) => a.weights.mtowLb, unit: 'lb' },
  { label: 'OEW', get: (a) => a.weights.oewLb ?? null, unit: 'lb' },
  { label: 'Fuel', get: (a) => a.weights.fuelCapacityLb, unit: 'lb', higherIsBetter: true },
  { label: 'Length', get: (a) => a.dimensions.lengthFt, unit: 'ft' },
  { label: 'Wingspan', get: (a) => a.dimensions.wingspanFt, unit: 'ft' },
  { label: 'Thrust/weight', get: (a) => (a.engines.thrustLbf ? (a.engines.thrustLbf * a.engines.count) / a.weights.mtowLb : null), higherIsBetter: true },
  { label: 'Fuel per seat', get: (a) => a.weights.fuelCapacityLb / a.seats.typical, unit: 'lb' },
];

export function AircraftCompare() {
  const [params, setParams] = useSearchParams();
  const [a, setA] = useState(params.get('a') ?? 'crj700');
  const [b, setB] = useState(params.get('b') ?? 'crj900');

  const left = findAircraft(a);
  const right = findAircraft(b);

  const pick = (which: 'a' | 'b', value: string) => {
    if (which === 'a') setA(value);
    else setB(value);
    const next = new URLSearchParams(params);
    next.set(which, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <TopBar title="Compare" back />
      <Screen>
        <div className="inline-fields" style={{ marginTop: 4, marginBottom: 14 }}>
          <select value={a} onChange={(e) => pick('a', e.target.value)} aria-label="First aircraft">
            {AIRCRAFT.map((x) => (
              <option key={x.id} value={x.id}>
                {x.variant.split(' (')[0]}
              </option>
            ))}
          </select>
          <select value={b} onChange={(e) => pick('b', e.target.value)} aria-label="Second aircraft">
            {AIRCRAFT.map((x) => (
              <option key={x.id} value={x.id}>
                {x.variant.split(' (')[0]}
              </option>
            ))}
          </select>
        </div>

        {left && right ? (
          <>
            <div className="compare-grid">
              <div className="hdr" />
              <div className="hdr">{left.variant.split(' (')[0]}</div>
              <div className="hdr">{right.variant.split(' (')[0]}</div>
              {ROWS.map((row) => {
                const lv = row.get(left);
                const rv = row.get(right);
                // A 1 lb difference is not a win. Require a material gap.
                const material =
                  lv !== null && rv !== null && Math.abs(lv - rv) / Math.max(Math.abs(lv), Math.abs(rv)) > 0.01;
                const better = row.higherIsBetter && material && lv !== null && rv !== null ? (lv > rv ? 'l' : 'r') : null;
                return (
                  <Fragment key={row.label}>
                    <div className="hdr">{row.label}</div>
                    <div className={`num${better === 'l' ? ' win' : ''}`}>{fmt(lv, row.unit)}</div>
                    <div className={`num${better === 'r' ? ' win' : ''}`}>{fmt(rv, row.unit)}</div>
                  </Fragment>
                );
              })}
            </div>

            <Panel title="The difference in a sentence">
              <p className="small dim" style={{ margin: 0 }}>
                {compareSentence(left, right)}
              </p>
            </Panel>

            <div className="btn-row">
              <Link className="btn ghost" to={`/deck/aircraft/${left.id}`}>
                {left.icaoType} profile
              </Link>
              <Link className="btn ghost" to={`/deck/aircraft/${right.id}`}>
                {right.icaoType} profile
              </Link>
            </div>
          </>
        ) : (
          <Empty glyph="✈" title="Pick two aircraft" />
        )}
      </Screen>
    </>
  );
}

function fmt(v: number | null, unit?: string): string {
  if (v === null) return '—';
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2).replace(/\.00$/, '');
  return unit ? `${rounded} ${unit}` : rounded;
}

function compareSentence(a: AircraftSpec, b: AircraftSpec): string {
  const nameB = b.variant.split(' (')[0];
  const seatDelta = b.seats.typical - a.seats.typical;
  const lenDelta = b.dimensions.lengthFt - a.dimensions.lengthFt;
  const rangeDelta = b.performance.rangeNm - a.performance.rangeNm;

  const clauses: string[] = [];
  if (Math.abs(seatDelta) >= 1) {
    clauses.push(
      `carries ${Math.abs(seatDelta)} ${seatDelta > 0 ? 'more' : 'fewer'} passengers in a typical layout`,
    );
  }
  if (Math.abs(lenDelta) >= 1) {
    clauses.push(`is ${Math.abs(lenDelta).toFixed(1)} ft ${lenDelta > 0 ? 'longer' : 'shorter'}`);
  }
  if (Math.abs(rangeDelta) >= 50) {
    clauses.push(`goes ${Math.abs(rangeDelta).toLocaleString()} nm ${rangeDelta > 0 ? 'further' : 'less far'}`);
  }

  const sentences: string[] = [];
  if (clauses.length > 0) {
    const joined =
      clauses.length === 1
        ? clauses[0]
        : `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
    sentences.push(`The ${nameB} ${joined}.`);
  }

  if (a.engines.model === b.engines.model) {
    sentences.push(`Both run the ${a.engines.model}, so the differences are airframe, not powerplant.`);
  } else {
    sentences.push(`Different powerplants: ${a.engines.model} against ${b.engines.model}.`);
  }

  if (sentences.length === 1 && clauses.length === 0) {
    return `These two are closely matched on the published figures. ${sentences[0]}`;
  }
  return sentences.join(' ');
}
