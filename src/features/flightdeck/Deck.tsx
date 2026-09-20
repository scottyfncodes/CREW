import { Screen, TopBar } from '../../app/AppShell';
import { useNow } from '../../app/useNow';
import { buildContext } from '../../core/context/engine';
import { findAirport } from '../../data/airportIndex';
import { aircraftLabel } from '../../data/aircraft';
import { primaryTrip } from '../../core/context/schedule';
import { useCrew } from '../../store/store';
import { Advisory, Panel, RowLink } from '../../ui/primitives';

export const TOOLS = [
  { slug: 'wind', name: 'Wind components', blurb: 'Head, tail and crosswind against a runway, plus the favoured end.' },
  { slug: 'speed', name: 'Airspeed & Mach', blurb: 'CAS, TAS and Mach at altitude, with the local speed of sound.' },
  { slug: 'altitude', name: 'Pressure & density altitude', blurb: 'What the field is really doing to your performance today.' },
  { slug: 'descent', name: 'Descent geometry', blurb: 'Top of descent, gradients, vertical speed and the 3:1 rule.' },
  { slug: 'tsd', name: 'Time, speed, distance', blurb: 'Solve for whichever one you are missing.' },
  { slug: 'gc', name: 'Great circle', blurb: 'Distance and initial course between any two airports CREW carries.' },
  { slug: 'convert', name: 'Conversions', blurb: 'Fuel, weight, distance, temperature, pressure.' },
  { slug: 'tz', name: 'Time zones', blurb: 'What time it is at every airport on the trip, at once.' },
];

export function Deck() {
  const state = useCrew();
  const now = useNow();
  const ctx = buildContext(state.pilot, primaryTrip(state.trips, now), now);
  const todayAircraft = ctx.day?.legs.find((l) => l.aircraftId)?.aircraftId ?? state.pilot.fleet[0];
  const todayAirports = [...new Set((ctx.day?.legs ?? []).flatMap((l) => [l.from, l.to]))]
    .map((c) => findAirport(c))
    .filter(Boolean);

  return (
    <>
      <TopBar title="Flight Deck" />
      <Screen>
        {(todayAircraft || todayAirports.length > 0) && (
          <Panel title="From today's trip">
            {todayAircraft && (
              <RowLink to={`/deck/aircraft/${todayAircraft}`}>
                <div className="strong">{aircraftLabel(todayAircraft)}</div>
                <div className="tiny faint">Aircraft profile</div>
              </RowLink>
            )}
            {todayAirports.map((a) => (
              <RowLink key={a!.icao} to={`/deck/airport/${a!.icao}`}>
                <div className="strong">
                  {a!.iata} · {a!.name}
                </div>
                <div className="tiny faint">
                  {a!.elevationFt} ft · {a!.runways.length} runways
                </div>
              </RowLink>
            ))}
          </Panel>
        )}

        <Panel title="Reference">
          <RowLink to="/deck/aircraft">
            <div className="strong">Aircraft</div>
            <div className="tiny faint">Specifications, engineering, history</div>
          </RowLink>
          <RowLink to="/deck/compare">
            <div className="strong">Compare aircraft</div>
            <div className="tiny faint">Two types side by side</div>
          </RowLink>
          <RowLink to="/deck/airports">
            <div className="strong">Airports</div>
            <div className="tiny faint">Runways, elevation, weather, what's worth knowing</div>
          </RowLink>
        </Panel>

        <Panel title="Calculators">
          {TOOLS.map((t) => (
            <RowLink key={t.slug} to={`/deck/calc/${t.slug}`}>
              <div className="strong">{t.name}</div>
              <div className="tiny faint">{t.blurb}</div>
            </RowLink>
          ))}
        </Panel>

        <Advisory>
          Every calculator here uses standard textbook relationships. None of it is performance data, and none of it
          replaces the AFM, the FCOM or your company's numbers.
        </Advisory>

        <Panel title="Official sources">
          <RowLink href="https://aviationweather.gov/">
            <div className="strong">NWS Aviation Weather Center</div>
          </RowLink>
          <RowLink href="https://www.faa.gov/air_traffic/publications/">
            <div className="strong">FAA publications & Chart Supplement</div>
          </RowLink>
          <RowLink href="https://notams.aim.faa.gov/notamSearch/">
            <div className="strong">FAA NOTAM search</div>
          </RowLink>
          <RowLink href="https://tfr.faa.gov/">
            <div className="strong">FAA temporary flight restrictions</div>
          </RowLink>
        </Panel>
      </Screen>
    </>
  );
}
