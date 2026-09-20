import { Link } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { useCrew } from '../../store/store';
import { Panel, RowLink } from '../../ui/primitives';
import { TOOLS as CALCULATORS } from '../flightdeck/Deck';

/**
 * Tools: everything that isn't the Schedule -> Today -> Logbook loop, but
 * still earns a place in the app — calculators, aircraft and airport
 * reference, pay, games, and settings.
 */
export function Tools() {
  const state = useCrew();
  const totalPlayed = Object.values(state.games).reduce((n, g) => n + g.played, 0);

  return (
    <>
      <TopBar title="Tools" />
      <Screen>
        <Panel title="Reference">
          <RowLink to="/deck/aircraft">
            <div className="strong">Aircraft</div>
            <div className="tiny faint">Specifications, engineering, history, compare</div>
          </RowLink>
          <RowLink to="/deck/airports">
            <div className="strong">Airports</div>
            <div className="tiny faint">Runways, elevation, weather, what's worth knowing</div>
          </RowLink>
          <RowLink to="/layover">
            <div className="strong">Layover guides</div>
            <div className="tiny faint">Browse any city, not just the one you're in</div>
          </RowLink>
        </Panel>

        <Panel title="Calculators">
          {CALCULATORS.slice(0, 4).map((t) => (
            <RowLink key={t.slug} to={`/deck/calc/${t.slug}`}>
              <div className="strong">{t.name}</div>
              <div className="tiny faint">{t.blurb}</div>
            </RowLink>
          ))}
          <RowLink to="/deck">
            <div className="strong">All calculators</div>
            <div className="tiny faint">{CALCULATORS.length} tools — wind, speed, altitude, navigation and more</div>
          </RowLink>
        </Panel>

        <Panel title="Money">
          <RowLink to="/offduty">
            <div className="strong">Pay & expenses</div>
            <div className="tiny faint">Trip earnings from your own rates, per diem, expense tracking</div>
          </RowLink>
        </Panel>

        <Panel title="Play">
          <RowLink to="/play">
            <div className="strong">Games</div>
            <div className="tiny faint">
              Aircraft, airports, distance and engine trivia
              {totalPlayed > 0 ? ` · ${totalPlayed} played` : ''}
            </div>
          </RowLink>
        </Panel>

        <Panel title="App">
          <RowLink to="/settings">
            <div className="strong">Settings</div>
            <div className="tiny faint">Airports, commute, pay assumptions, food preferences, data</div>
          </RowLink>
        </Panel>

        <div className="tiny faint" style={{ textAlign: 'center', margin: '4px 0 12px' }}>
          Have a whole pairing to add? <Link to="/schedule/import">Paste it</Link> from Schedule.
        </div>
      </Screen>
    </>
  );
}
