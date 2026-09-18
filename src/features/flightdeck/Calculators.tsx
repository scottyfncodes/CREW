import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import {
  densityAltitudeFt,
  isaDeviationC,
  isaTempC,
  casToTas,
  machToTas,
  pressureAltitudeFt,
  speedOfSoundKt,
  tasToCas,
  tasToMach,
} from '../../core/calc/atmosphere';
import {
  descentDistanceNm,
  gradientFtPerNm,
  gradientToAngleDeg,
  greatCircleNm,
  initialBearingDeg,
  requiredVerticalSpeedFpm,
  threeDegreeVsFpm,
  timeMinutes,
  distanceNm as dist,
  groundspeedKt as gsCalc,
  topOfDescentNm,
} from '../../core/calc/navigation';
import { favoredRunway, solveWindTriangle, windComponents } from '../../core/calc/wind';
import * as U from '../../core/calc/units';
import { formatDuration, timeIn, zoneAbbr } from '../../core/time/time';
import { buildContext } from '../../core/context/engine';
import { AIRPORTS, findAirport, runwayEnds } from '../../data/airportIndex';
import { activeTrip } from '../../store/state';
import { useCrew } from '../../store/store';
import { Advisory, Empty, Field, Panel, Stat, Stats } from '../../ui/primitives';
import { TOOLS } from './Deck';

export function Calculator() {
  const { tool = '' } = useParams();
  const meta = TOOLS.find((t) => t.slug === tool);

  const body = (() => {
    switch (tool) {
      case 'wind':
        return <WindTool />;
      case 'speed':
        return <SpeedTool />;
      case 'altitude':
        return <AltitudeTool />;
      case 'descent':
        return <DescentTool />;
      case 'tsd':
        return <TsdTool />;
      case 'gc':
        return <GreatCircleTool />;
      case 'convert':
        return <ConvertTool />;
      case 'tz':
        return <TimeZoneTool />;
      default:
        return <Empty glyph="◇" title="Unknown tool" />;
    }
  })();

  return (
    <>
      <TopBar title={meta?.name ?? 'Calculator'} back />
      <Screen>{body}</Screen>
    </>
  );
}

// --------------------------------------------------------------- helpers

function useNumber(initial: number): [number, string, (v: string) => void] {
  const [raw, setRaw] = useState(String(initial));
  const parsed = Number(raw);
  return [Number.isFinite(parsed) ? parsed : 0, raw, setRaw];
}

function NumField({
  label,
  value,
  onChange,
  hint,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  step?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

const fx = (n: number, places = 0) => (Number.isFinite(n) ? n.toFixed(places) : '—');

// ------------------------------------------------------------------ wind

function WindTool() {
  const [rwy, rwyRaw, setRwy] = useNumber(180);
  const [dir, dirRaw, setDir] = useNumber(210);
  const [spd, spdRaw, setSpd] = useNumber(18);
  const [tas, tasRaw, setTas] = useNumber(280);
  const [airportCode, setAirportCode] = useState('');

  const comp = windComponents(rwy, dir, spd);
  const triangle = solveWindTriangle(rwy, tas, dir, spd);
  const airport = findAirport(airportCode);
  const ends = airport ? runwayEnds(airport) : [];
  const favored = ends.length ? favoredRunway(ends, dir, spd) : null;

  return (
    <>
      <Panel title="Wind">
        <div className="inline-fields">
          <NumField label="Runway / course °" value={rwyRaw} onChange={setRwy} />
          <NumField label="Wind from °" value={dirRaw} onChange={setDir} />
        </div>
        <NumField label="Wind speed (kt)" value={spdRaw} onChange={setSpd} />
      </Panel>

      <Panel title="Components">
        <Stats>
          <Stat
            k={comp.headwindKt >= 0 ? 'Headwind' : 'Tailwind'}
            v={`${fx(Math.abs(comp.headwindKt), 1)} kt`}
            tone={comp.headwindKt >= 0 ? 'go' : 'caution'}
          />
          <Stat
            k={`Crosswind ${comp.crosswindFrom === 'none' ? '' : `(${comp.crosswindFrom})`}`}
            v={`${fx(comp.crosswindKt, 1)} kt`}
            tone={comp.crosswindKt >= 25 ? 'warn' : comp.crosswindKt >= 15 ? 'caution' : undefined}
          />
          <Stat k="Angle off" v={`${fx(comp.angleDeg)}°`} />
        </Stats>
        <Advisory>
          Crosswind limits are in the AFM and your company's operations manual — CREW does not know them and will never
          tell you a wind is acceptable.
        </Advisory>
      </Panel>

      <Panel title="Wind triangle">
        <NumField label="True airspeed (kt)" value={tasRaw} onChange={setTas} />
        {triangle ? (
          <Stats>
            <Stat k="Heading" v={`${fx(triangle.headingDeg)}°`} />
            <Stat k="Groundspeed" v={`${fx(triangle.groundspeedKt)} kt`} />
            <Stat k="Drift" v={`${triangle.wcaDeg >= 0 ? '+' : ''}${fx(triangle.wcaDeg, 1)}°`} />
          </Stats>
        ) : (
          <div className="small caution-text">The wind is too strong for that course at that airspeed.</div>
        )}
      </Panel>

      <Panel title="Against a real airfield">
        <Field label="Airport" hint="Any airport CREW carries — try CLT, DCA, DAY.">
          <input
            type="search"
            value={airportCode}
            onChange={(e) => setAirportCode(e.target.value)}
            placeholder="CLT"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </Field>
        {airport && favored && (
          <>
            <div className="small dim" style={{ marginBottom: 8 }}>
              Best-aligned end at {airport.iata} for {String(Math.round(dir)).padStart(3, '0')}° / {Math.round(spd)} kt:
            </div>
            <Stats>
              <Stat k="Runway" v={favored.ident} />
              <Stat k="Headwind" v={`${fx(favored.components.headwindKt, 1)} kt`} tone="go" />
              <Stat k="Crosswind" v={`${fx(favored.components.crosswindKt, 1)} kt`} />
            </Stats>
            <div className="tiny faint" style={{ marginTop: 8 }}>
              Based on published magnetic runway headings. Runway in use is ATC's call.
            </div>
          </>
        )}
        {airportCode && !airport && <div className="small faint">Not in CREW's dataset.</div>}
      </Panel>
    </>
  );
}

// ----------------------------------------------------------------- speed

function SpeedTool() {
  const [alt, altRaw, setAlt] = useNumber(35000);
  const [oat, oatRaw, setOat] = useNumber(-50);
  const [cas, casRaw, setCas] = useNumber(280);
  const [mach, machRaw, setMach] = useNumber(0.78);

  const a = speedOfSoundKt(oat);
  const tasFromCas = casToTas(cas, alt, oat);
  const machFromCas = tasToMach(tasFromCas, oat);
  const tasFromMach = machToTas(mach, oat);
  const casFromMach = tasToCas(tasFromMach, alt, oat);
  const isaDev = isaDeviationC(alt, oat);

  return (
    <>
      <Panel title="Conditions">
        <div className="inline-fields">
          <NumField label="Pressure altitude (ft)" value={altRaw} onChange={setAlt} step="500" />
          <NumField label="OAT (°C)" value={oatRaw} onChange={setOat} />
        </div>
        <Stats>
          <Stat k="ISA temp" v={`${fx(isaTempC(alt), 1)}°C`} />
          <Stat k="ISA dev" v={`${isaDev >= 0 ? '+' : ''}${fx(isaDev, 1)}°C`} tone={Math.abs(isaDev) > 10 ? 'caution' : undefined} />
          <Stat k="Speed of sound" v={`${fx(a)} kt`} />
        </Stats>
      </Panel>

      <Panel title="From calibrated airspeed">
        <NumField label="CAS (kt)" value={casRaw} onChange={setCas} />
        <Stats>
          <Stat k="TAS" v={`${fx(tasFromCas)} kt`} tone="accent" />
          <Stat k="Mach" v={`M${fx(machFromCas, 3)}`} />
          <Stat k="TAS − CAS" v={`${fx(tasFromCas - cas)} kt`} />
        </Stats>
      </Panel>

      <Panel title="From Mach">
        <NumField label="Mach" value={machRaw} onChange={setMach} step="0.01" />
        <Stats>
          <Stat k="TAS" v={`${fx(tasFromMach)} kt`} tone="accent" />
          <Stat k="CAS" v={`${fx(casFromMach)} kt`} />
        </Stats>
      </Panel>

      <Advisory>
        Compressible subsonic relationships from the standard atmosphere. Instrument and position error are not
        modelled, so this will not match your airspeed indicator exactly.
      </Advisory>
    </>
  );
}

// -------------------------------------------------------------- altitude

function AltitudeTool() {
  const [elev, elevRaw, setElev] = useNumber(748);
  const [altim, altimRaw, setAltim] = useNumber(29.92);
  const [oat, oatRaw, setOat] = useNumber(15);
  const [code, setCode] = useState('KCLT');

  const airport = findAirport(code);

  const useElev = airport ? airport.elevationFt : elev;
  const pa = pressureAltitudeFt(useElev, altim);
  const da = densityAltitudeFt(pa, oat);
  const dev = isaDeviationC(pa, oat);

  return (
    <>
      <Panel title="Field">
        <Field label="Airport (optional)" hint="Fills elevation from CREW's dataset.">
          <input
            type="search"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="KCLT"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </Field>
        {!airport && <NumField label="Field elevation (ft)" value={elevRaw} onChange={setElev} />}
        {airport && (
          <div className="small dim" style={{ marginBottom: 12 }}>
            {airport.name} · <span className="mono">{airport.elevationFt} ft</span>
          </div>
        )}
        <div className="inline-fields">
          <NumField label="Altimeter (inHg)" value={altimRaw} onChange={setAltim} step="0.01" />
          <NumField label="OAT (°C)" value={oatRaw} onChange={setOat} />
        </div>
      </Panel>

      <Panel title="Result">
        <Stats>
          <Stat k="Pressure alt" v={`${Math.round(pa).toLocaleString()} ft`} />
          <Stat
            k="Density alt"
            v={`${Math.round(da).toLocaleString()} ft`}
            tone={da - useElev > 3000 ? 'warn' : da - useElev > 1500 ? 'caution' : 'go'}
          />
          <Stat k="ISA dev" v={`${dev >= 0 ? '+' : ''}${fx(dev, 1)}°C`} />
          <Stat k="DA − field" v={`${Math.round(da - useElev).toLocaleString()} ft`} />
        </Stats>
        <div className="small dim" style={{ marginTop: 10 }}>
          Altimeter setting in hPa: <span className="mono strong">{fx(U.inHgToHpa(altim), 1)}</span>
        </div>
        <Advisory>
          Density altitude here is the standard-atmosphere relationship, useful for understanding the day. Takeoff and
          landing performance comes from the AFM and your performance system.
        </Advisory>
      </Panel>
    </>
  );
}

// --------------------------------------------------------------- descent

function DescentTool() {
  const [cruise, cruiseRaw, setCruise] = useNumber(35000);
  const [target, targetRaw, setTarget] = useNumber(3000);
  const [gs, gsRaw, setGs] = useNumber(420);
  const [gradient, gradientRaw, setGradient] = useNumber(318);
  const [pad, padRaw, setPad] = useNumber(10);
  const [distanceToGo, distRaw, setDist] = useNumber(100);

  const toLose = cruise - target;
  const tod = topOfDescentNm(cruise, target, gradient, pad);
  const vs = requiredVerticalSpeedFpm(toLose, descentDistanceNm(toLose, gradient) ?? 1, gs);
  const threeOne = (toLose / 1000) * 3;
  const requiredNow = gradientFtPerNm(toLose, distanceToGo);
  const angleNow = requiredNow ? gradientToAngleDeg(requiredNow) : null;
  const vsNow = requiredVerticalSpeedFpm(toLose, distanceToGo, gs);

  return (
    <>
      <Panel title="Profile">
        <div className="inline-fields">
          <NumField label="Cruise (ft)" value={cruiseRaw} onChange={setCruise} step="1000" />
          <NumField label="Target (ft)" value={targetRaw} onChange={setTarget} step="500" />
        </div>
        <div className="inline-fields">
          <NumField label="Groundspeed (kt)" value={gsRaw} onChange={setGs} step="10" />
          <NumField label="Gradient (ft/nm)" value={gradientRaw} onChange={setGradient} step="10" hint="318 ft/nm ≈ 3°" />
        </div>
        <NumField label="Level-off pad (nm)" value={padRaw} onChange={setPad} />
      </Panel>

      <Panel title="Top of descent">
        <Stats>
          <Stat k="To lose" v={`${toLose.toLocaleString()} ft`} />
          <Stat k="TOD" v={tod === null ? '—' : `${fx(tod, 1)} nm`} tone="accent" />
          <Stat k="3:1 rule" v={`${fx(threeOne, 1)} nm`} sub={`+${pad} pad`} />
          <Stat k="Vertical speed" v={vs === null ? '—' : `${Math.round(vs / 50) * 50} fpm`} />
        </Stats>
        <div className="small dim" style={{ marginTop: 10 }}>
          The classic 3° rule of thumb at this groundspeed:{' '}
          <span className="mono strong">{Math.round(threeDegreeVsFpm(gs))} fpm</span>
        </div>
      </Panel>

      <Panel title="Am I high?">
        <NumField label="Distance to the fix (nm)" value={distRaw} onChange={setDist} />
        <Stats>
          <Stat
            k="Required"
            v={requiredNow === null ? '—' : `${Math.round(requiredNow)} ft/nm`}
            tone={requiredNow && requiredNow > 400 ? 'warn' : requiredNow && requiredNow > 340 ? 'caution' : 'go'}
          />
          <Stat k="Angle" v={angleNow === null ? '—' : `${fx(angleNow, 1)}°`} />
          <Stat k="Needs" v={vsNow === null ? '—' : `${Math.round(vsNow / 50) * 50} fpm`} />
        </Stats>
        <div className="tiny faint" style={{ marginTop: 8 }}>
          Geometry only — no wind, no drag, no speed reduction. Your FMS and the published procedure are the reference.
        </div>
      </Panel>
    </>
  );
}

// ------------------------------------------------------------------- tsd

function TsdTool() {
  const [d, dRaw, setD] = useNumber(220);
  const [s, sRaw, setS] = useNumber(420);
  const [t, tRaw, setT] = useNumber(31);

  return (
    <>
      <Panel title="Enter any two">
        <NumField label="Distance (nm)" value={dRaw} onChange={setD} />
        <NumField label="Groundspeed (kt)" value={sRaw} onChange={setS} />
        <NumField label="Time (minutes)" value={tRaw} onChange={setT} />
      </Panel>
      <Panel title="Solved">
        <Stats>
          <Stat k="Time" v={formatDuration(timeMinutes(d, s))} sub={`${d} nm at ${s} kt`} />
          <Stat k="Distance" v={`${fx(dist(s, t), 1)} nm`} sub={`${s} kt for ${t} min`} />
          <Stat k="Groundspeed" v={`${fx(gsCalc(d, t) ?? NaN)} kt`} sub={`${d} nm in ${t} min`} />
        </Stats>
        <div className="small dim" style={{ marginTop: 10 }}>
          Minute-per-mile check: at <span className="mono">{s}</span> kt you cover{' '}
          <span className="mono strong">{fx(s / 60, 1)} nm</span> a minute.
        </div>
      </Panel>
    </>
  );
}

// --------------------------------------------------------- great circle

function GreatCircleTool() {
  const [from, setFrom] = useState('KDAY');
  const [to, setTo] = useState('KCLT');
  const [gs, gsRaw, setGs] = useNumber(420);

  const a = findAirport(from);
  const b = findAirport(to);
  const nm = a && b ? greatCircleNm(a.pos, b.pos) : null;
  const brg = a && b ? initialBearingDeg(a.pos, b.pos) : null;
  const mins = nm !== null ? timeMinutes(nm, gs) : null;

  return (
    <>
      <Panel title="Route">
        <div className="inline-fields">
          <Field label="From">
            <input type="search" value={from} onChange={(e) => setFrom(e.target.value)} autoCapitalize="characters" autoCorrect="off" />
          </Field>
          <Field label="To">
            <input type="search" value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="characters" autoCorrect="off" />
          </Field>
        </div>
        <NumField label="Groundspeed (kt)" value={gsRaw} onChange={setGs} step="10" />
      </Panel>

      {a && b ? (
        <Panel title={`${a.iata} → ${b.iata}`}>
          <Stats>
            <Stat k="Great circle" v={`${Math.round(nm!).toLocaleString()} nm`} tone="accent" />
            <Stat k="Initial course" v={`${Math.round(brg!)}°T`} />
            <Stat k="Statute" v={`${Math.round(U.nmToSm(nm!)).toLocaleString()} sm`} />
            <Stat k="Kilometres" v={`${Math.round(U.nmToKm(nm!)).toLocaleString()} km`} />
          </Stats>
          <div className="small dim" style={{ marginTop: 10 }}>
            At {gs} kt that is <span className="mono strong">{formatDuration(mins)}</span> in still air.
          </div>
          <div className="tiny faint" style={{ marginTop: 6 }}>
            Great-circle distance between field reference points. Not a flight-planned track — no airways, no SIDs, no
            wind.
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="small faint">Enter two airports CREW carries.</div>
        </Panel>
      )}
    </>
  );
}

// ------------------------------------------------------------- converter

const CONVERSIONS: { group: string; rows: { label: string; from: string; to: string; fn: (v: number) => number }[] }[] = [
  {
    group: 'Fuel & weight',
    rows: [
      { label: 'Pounds → kilograms', from: 'lb', to: 'kg', fn: U.lbToKg },
      { label: 'Kilograms → pounds', from: 'kg', to: 'lb', fn: U.kgToLb },
      { label: 'US gallons → pounds', from: 'gal', to: 'lb', fn: (v) => U.galToLb(v) },
      { label: 'Pounds → US gallons', from: 'lb', to: 'gal', fn: (v) => U.lbToGal(v) },
      { label: 'Litres → US gallons', from: 'L', to: 'gal', fn: U.litersToGal },
    ],
  },
  {
    group: 'Distance & altitude',
    rows: [
      { label: 'Nautical → statute miles', from: 'nm', to: 'sm', fn: U.nmToSm },
      { label: 'Nautical miles → km', from: 'nm', to: 'km', fn: U.nmToKm },
      { label: 'Feet → metres', from: 'ft', to: 'm', fn: U.ftToM },
      { label: 'Metres → feet', from: 'm', to: 'ft', fn: U.mToFt },
    ],
  },
  {
    group: 'Speed',
    rows: [
      { label: 'Knots → mph', from: 'kt', to: 'mph', fn: U.ktToMph },
      { label: 'Knots → km/h', from: 'kt', to: 'km/h', fn: U.ktToKph },
      { label: 'Knots → m/s', from: 'kt', to: 'm/s', fn: U.ktToMs },
    ],
  },
  {
    group: 'Temperature & pressure',
    rows: [
      { label: 'Celsius → Fahrenheit', from: '°C', to: '°F', fn: U.cToF },
      { label: 'Fahrenheit → Celsius', from: '°F', to: '°C', fn: U.fToC },
      { label: 'inHg → hPa', from: 'inHg', to: 'hPa', fn: U.inHgToHpa },
      { label: 'hPa → inHg', from: 'hPa', to: 'inHg', fn: U.hpaToInHg },
    ],
  },
];

function ConvertTool() {
  const [value, raw, setRaw] = useNumber(1000);

  return (
    <>
      <Panel title="Value">
        <NumField label="Convert" value={raw} onChange={setRaw} />
        <div className="tiny faint">
          Jet A is taken as {U.DEFAULT_JETA_LB_PER_GAL} lb/US gal — the common planning figure. Actual density varies
          with temperature and is on the fuel slip.
        </div>
      </Panel>
      {CONVERSIONS.map((g) => (
        <Panel key={g.group} title={g.group}>
          {g.rows.map((r) => (
            <div key={r.label} className="row" style={{ padding: '9px 0' }}>
              <span className="grow small">{r.label}</span>
              <span className="mono strong">
                {U.round(r.fn(value), 2).toLocaleString()} {r.to}
              </span>
            </div>
          ))}
        </Panel>
      ))}
    </>
  );
}

// ------------------------------------------------------------- timezones

function TimeZoneTool() {
  const now = useNow(1000);
  const state = useCrew();
  const trip = activeTrip(state);
  const ctx = buildContext(state.pilot, trip, now);
  const [extra, setExtra] = useState('');

  const codes = useMemo(() => {
    const set = new Set<string>();
    set.add(state.pilot.homeAirport);
    set.add(state.pilot.baseAirport);
    for (const d of trip?.days ?? []) {
      for (const l of d.legs) {
        set.add(l.from);
        set.add(l.to);
      }
    }
    const typed = findAirport(extra);
    if (typed) set.add(typed.icao);
    return [...set].map((c) => findAirport(c)).filter(Boolean);
  }, [state.pilot.homeAirport, state.pilot.baseAirport, trip, extra]);

  const zulu = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

  return (
    <>
      <Panel title="Zulu">
        <div className="hero-time">{zulu}</div>
        <div className="small faint">UTC · the only clock that never argues</div>
      </Panel>

      <Panel title="Your trip">
        {codes.map((a) => (
          <div key={a!.icao} className="row">
            <span className="mono strong" style={{ width: 46, flex: 'none' }}>
              {a!.iata}
            </span>
            <div className="grow small">
              <span className="faint">{a!.city}</span>
            </div>
            <span className="mono strong" style={{ flex: 'none' }}>
              {timeIn(now, a!.tz)}
            </span>
            <span className="tiny faint mono" style={{ width: 38, textAlign: 'right', flex: 'none' }}>
              {zoneAbbr(now, a!.tz)}
            </span>
          </div>
        ))}
        {ctx.locationIcao && (
          <div className="tiny faint" style={{ marginTop: 8 }}>
            CREW thinks you are at {findAirport(ctx.locationIcao)?.iata ?? ctx.locationIcao}.
          </div>
        )}
      </Panel>

      <Panel title="Add an airport">
        <Field label="Code" hint={`${AIRPORTS.length} airports in the dataset.`}>
          <input
            type="search"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="PHX"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </Field>
      </Panel>
    </>
  );
}
