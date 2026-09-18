import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { windComponents } from '../../core/calc/wind';
import { greatCircleNm, initialBearingDeg } from '../../core/calc/navigation';
import { timeIn, zoneAbbr } from '../../core/time/time';
import { findAirport, longestRunwayFt, runwayEnds, searchAirports } from '../../data/airportIndex';
import { guideForAirport } from '../../data/layovers';
import { useCrew } from '../../store/store';
import { airportVisits } from '../../core/context/stats';
import { Advisory, Empty, Panel, SourceLinks, Stat, Stats } from '../../ui/primitives';
import { officialWeatherLinks } from '../../services/weather';
import { useForecast, useMetar, useTaf } from '../weather/useWeather';
import { WeatherStrip } from '../weather/WeatherStrip';
import { Provenance } from '../../ui/primitives';

export function AirportProfile() {
  const { icao = '' } = useParams();
  const airport = findAirport(icao);
  const now = useNow();
  const state = useCrew();

  const wx = useForecast(airport, 3);
  const metar = useMetar(airport?.icao ?? null);
  const taf = useTaf(airport?.icao ?? null);

  const visits = useMemo(
    () => airportVisits(state.flights).find((v) => v.icao === airport?.icao) ?? null,
    [state.flights, airport?.icao],
  );

  const homeAirport = findAirport(state.pilot.homeAirport);

  if (!airport) {
    return (
      <>
        <TopBar title="Airport" back />
        <Screen>
          <Empty glyph="◇" title={`${icao.toUpperCase()} is not in CREW's dataset`}>
            CREW carries a curated set of airports rather than a partial copy of everything. Look it up on{' '}
            <a href={`https://www.airnav.com/airport/${icao.toUpperCase()}`} target="_blank" rel="noreferrer noopener">
              AirNav
            </a>
            .
          </Empty>
        </Screen>
      </>
    );
  }

  const guide = guideForAirport(airport.icao);
  const obsWind = metar.result?.data;

  return (
    <>
      <TopBar title={`${airport.iata} · ${airport.icao}`} back />
      <Screen>
        <div style={{ padding: '4px 0 14px' }}>
          <div className="big" style={{ fontSize: 24 }}>
            {airport.name}
          </div>
          <div className="small dim">
            {airport.city}, {airport.region} · {timeIn(now, airport.tz)} {zoneAbbr(now, airport.tz)}
          </div>
        </div>

        <Stats>
          <Stat k="Elevation" v={airport.elevationFt.toLocaleString()} sub="ft MSL" />
          <Stat k="Longest" v={(longestRunwayFt(airport) ?? 0).toLocaleString()} sub="ft" />
          <Stat k="Runways" v={airport.runways.length} />
          {homeAirport && homeAirport.icao !== airport.icao && (
            <Stat
              k={`From ${homeAirport.iata}`}
              v={Math.round(greatCircleNm(homeAirport.pos, airport.pos)).toLocaleString()}
              sub={`nm · ${Math.round(initialBearingDeg(homeAirport.pos, airport.pos))}°T`}
            />
          )}
        </Stats>

        <Panel title="Observation" className="tight">
          {metar.result?.data ? (
            <>
              <div className="mono small" style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>
                {metar.result.data.raw}
              </div>
              <Provenance
                sourceName={metar.result.source.name}
                fetchedAt={metar.result.fetchedAt}
                stale={metar.result.stale}
                error={metar.result.error}
              />
            </>
          ) : (
            <div className="small faint">
              {metar.loading ? 'Loading METAR…' : 'No observation available right now — use the official link below.'}
            </div>
          )}
        </Panel>

        {taf.result?.data?.raw && (
          <Panel title="Terminal forecast" className="tight">
            <div className="mono tiny" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {taf.result.data.raw}
            </div>
            <Provenance
              sourceName={taf.result.source.name}
              fetchedAt={taf.result.fetchedAt}
              stale={taf.result.stale}
              error={taf.result.error}
            />
          </Panel>
        )}

        <Panel title="Next 12 hours">
          <WeatherStrip airport={airport} result={wx.result} from={now} />
          <SourceLinks sources={officialWeatherLinks(airport.icao)} label="Official:" />
        </Panel>

        <Panel title="Runways">
          {airport.runways.length === 0 ? (
            <div className="small faint">Runway data not carried for this field.</div>
          ) : (
            <>
              {airport.runways.map((r) => (
                <div key={r.ident} className="row">
                  <span className="mono strong" style={{ width: 78, flex: 'none' }}>
                    {r.ident}
                  </span>
                  <div className="grow small">
                    <span className="mono">{r.lengthFt.toLocaleString()} ft</span>
                    {r.widthFt ? <span className="faint mono"> × {r.widthFt} ft</span> : null}
                    <div className="tiny faint">{r.surface}</div>
                  </div>
                </div>
              ))}
              {obsWind && obsWind.windDirDeg !== null && obsWind.windKt !== null && (
                <RunwayWind
                  airport={airport}
                  windDirDeg={obsWind.windDirDeg}
                  windKt={obsWind.windKt}
                  gustKt={obsWind.gustKt}
                />
              )}
            </>
          )}
          <Advisory>
            Runway dimensions here are transcribed reference data. Use the Chart Supplement, company charts and NOTAMs
            for anything operational.
          </Advisory>
          <SourceLinks sources={airport.sources} />
        </Panel>

        {airport.notes && airport.notes.length > 0 && (
          <Panel title="Worth knowing">
            {airport.notes.map((n) => (
              <p key={n} className="small dim" style={{ margin: '0 0 9px' }}>
                {n}
              </p>
            ))}
            {airport.spotting && (
              <>
                <div className="divider" />
                <div className="eyebrow" style={{ margin: '0 0 4px' }}>
                  Spotting
                </div>
                <p className="small dim" style={{ margin: 0 }}>
                  {airport.spotting}
                </p>
              </>
            )}
          </Panel>
        )}

        {visits && (
          <Panel title="Your history here">
            <Stats>
              <Stat k="Visits" v={visits.visits} />
              <Stat k="First" v={visits.first} sub="" />
              <Stat k="Last" v={visits.last} sub="" />
            </Stats>
          </Panel>
        )}

        {guide && (
          <Panel title="On the ground">
            <Link className="btn" to={`/layover/${guide.key}`}>
              {guide.city} layover guide
            </Link>
          </Panel>
        )}
      </Screen>
    </>
  );
}

/** Live crosswind picture against every runway end, from the current METAR. */
function RunwayWind({
  airport,
  windDirDeg,
  windKt,
  gustKt,
}: {
  airport: NonNullable<ReturnType<typeof findAirport>>;
  windDirDeg: number;
  windKt: number;
  gustKt: number | null;
}) {
  const ends = runwayEnds(airport)
    .map((e) => ({ ...e, comp: windComponents(e.headingDeg, windDirDeg, windKt) }))
    .sort((a, b) => b.comp.headwindKt - a.comp.headwindKt)
    .slice(0, 4);

  return (
    <>
      <div className="divider" />
      <div className="eyebrow" style={{ margin: '0 0 6px' }}>
        Wind components · {String(Math.round(windDirDeg)).padStart(3, '0')}° at {Math.round(windKt)} kt
        {gustKt ? ` G${Math.round(gustKt)}` : ''}
      </div>
      {ends.map((e) => (
        <div key={e.ident} className="row" style={{ padding: '8px 0' }}>
          <span className="mono strong" style={{ width: 46, flex: 'none' }}>
            {e.ident}
          </span>
          <span className="grow small mono">
            <span className={e.comp.headwindKt >= 0 ? 'go' : 'caution-text'}>
              {e.comp.headwindKt >= 0 ? 'H' : 'T'}
              {Math.abs(Math.round(e.comp.headwindKt))}
            </span>
            {e.comp.crosswindFrom !== 'none' && (
              <span className="faint">
                {' · '}X{Math.round(e.comp.crosswindKt)} from the {e.comp.crosswindFrom}
              </span>
            )}
          </span>
        </div>
      ))}
      <div className="tiny faint" style={{ marginTop: 4 }}>
        Computed from the reported surface wind and the runway's magnetic heading. Limits come from the AFM and your
        company's operations manual.
      </div>
    </>
  );
}

export function AirportList() {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchAirports(q, 60), [q]);
  const now = useNow();

  return (
    <>
      <TopBar title="Airports" back />
      <Screen>
        <div className="field" style={{ marginTop: 4 }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="CLT, KDCA, Charlotte…"
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </div>
        <Panel className="flush">
          <div className="list inset">
            {results.map((a) => (
              <Link key={a.icao} className="row" to={`/deck/airport/${a.icao}`}>
                <span className="mono strong" style={{ width: 46, flex: 'none' }}>
                  {a.iata}
                </span>
                <div className="grow">
                  <div className="small">{a.name}</div>
                  <div className="tiny faint">
                    {a.city}, {a.region} · {a.elevationFt} ft · {timeIn(now, a.tz)}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            ))}
            {results.length === 0 && (
              <Empty glyph="◇" title="No match in CREW's dataset">
                CREW carries {searchAirports('', 999).length} curated airports focused on the PSA and American network.
              </Empty>
            )}
          </div>
        </Panel>
        <div className="tiny faint" style={{ textAlign: 'center' }}>
          Reference data · verify on AirNav and the FAA Chart Supplement
        </div>
      </Screen>
    </>
  );
}
