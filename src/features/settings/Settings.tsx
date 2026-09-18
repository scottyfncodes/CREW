import { useState } from 'react';
import { Screen, TopBar } from '../../app/AppShell';
import type { CommuteMode } from '../../core/types';
import { AIRCRAFT } from '../../data/aircraft';
import { findAirport, searchAirports } from '../../data/airportIndex';
import { findAirline } from '../../data/airlines';
import { clearCache } from '../../services/fetcher';
import {
  clearSampleData,
  setAeroDataBoxKey,
  refreshSampleTrip,
  restoreSampleData,
  updatePay,
  updatePilot,
  updatePrefs,
} from '../../store/actions';
import { clearEverything, useCrew } from '../../store/store';
import { Advisory, Field, Panel, Toggle } from '../../ui/primitives';

const COMMUTE_MODES: { id: CommuteMode; label: string }[] = [
  { id: 'drive', label: 'Drive' },
  { id: 'transit', label: 'Transit' },
  { id: 'rideshare', label: 'Rideshare' },
  { id: 'walk', label: 'Walk' },
  { id: 'commute-by-air', label: 'Commute by air' },
];

const CUISINES = ['Southern', 'Barbecue', 'Seafood', 'Italian', 'Indian', 'Japanese', 'Mexican', 'Vegetarian'];
const ACTIVITIES: { id: string; label: string }[] = [
  { id: 'museum', label: 'Museums' },
  { id: 'run', label: 'Running' },
  { id: 'walk', label: 'Walking' },
  { id: 'aviation', label: 'Aviation' },
  { id: 'brewery', label: 'Breweries' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'landmark', label: 'Landmarks' },
  { id: 'oddity', label: 'Weird stuff' },
];

export function Settings() {
  const state = useCrew();
  const { pilot } = state;
  const [homeQuery, setHomeQuery] = useState('');
  const [baseQuery, setBaseQuery] = useState('');

  const hasSample = state.flights.some((f) => f.sample);
  const airline = findAirline(pilot.airlineCode);

  return (
    <>
      <TopBar title="Settings" back />
      <Screen>
        <Panel title="You">
          <Field label="Name">
            <input
              type="text"
              value={pilot.name}
              placeholder="Optional"
              onChange={(e) => updatePilot({ name: e.target.value })}
            />
          </Field>
          <div className="inline-fields">
            <Field label="Airline">
              <input type="text" value={pilot.airline} onChange={(e) => updatePilot({ airline: e.target.value })} />
            </Field>
            <Field label="Code" hint="Lets you type a bare flight number.">
              <input
                type="text"
                value={pilot.airlineCode ?? ''}
                placeholder="OH"
                maxLength={3}
                autoCapitalize="characters"
                autoCorrect="off"
                onChange={(e) => updatePilot({ airlineCode: e.target.value.toUpperCase() || null })}
              />
            </Field>
          </div>
          {airline && (
            <div className="small faint" style={{ marginTop: -4, marginBottom: 12 }}>
              {airline.name} · ICAO {airline.icao} · callsign "{airline.callsign}"
              {airline.operatesFor ? ` · flies for ${airline.operatesFor}` : ''}
            </div>
          )}
          <Field label="Seat">
            <select value={pilot.seat} onChange={(e) => updatePilot({ seat: e.target.value as 'FO' | 'CA' })}>
              <option value="FO">First Officer</option>
              <option value="CA">Captain</option>
            </select>
          </Field>
        </Panel>

        <Panel title="Airports">
          <AirportPicker
            label="Home airport"
            hint="Where your commute starts. Drives leave-home times."
            value={pilot.homeAirport}
            query={homeQuery}
            setQuery={setHomeQuery}
            onPick={(icao) => {
              updatePilot({ homeAirport: icao });
              setHomeQuery('');
            }}
          />
          <AirportPicker
            label="Base"
            hint="Where your trips are built from."
            value={pilot.baseAirport}
            query={baseQuery}
            setQuery={setBaseQuery}
            onPick={(icao) => {
              updatePilot({ baseAirport: icao });
              setBaseQuery('');
            }}
          />
        </Panel>

        <Panel title="Commute">
          <Field label="Commute mode">
            <select value={pilot.prefs.commuteMode} onChange={(e) => updatePrefs({ commuteMode: e.target.value as CommuteMode })}>
              {COMMUTE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="inline-fields">
            <Field label="Commute (min)">
              <input
                type="number"
                inputMode="numeric"
                value={pilot.prefs.commuteMinutes}
                onChange={(e) => updatePrefs({ commuteMinutes: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Airport buffer (min)">
              <input
                type="number"
                inputMode="numeric"
                value={pilot.prefs.airportBufferMinutes}
                onChange={(e) => updatePrefs({ airportBufferMinutes: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <div className="small dim">
            Leave home = report −{' '}
            <span className="mono strong">{pilot.prefs.commuteMinutes + pilot.prefs.airportBufferMinutes} min</span>
          </div>
        </Panel>

        <Panel title="Rest">
          <Field label="Sleep target (hours)" hint="Used to work out how much of a layover is genuinely usable.">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={pilot.prefs.sleepTargetMinutes / 60}
              onChange={(e) => updatePrefs({ sleepTargetMinutes: Math.round((Number(e.target.value) || 0) * 60) })}
            />
          </Field>
        </Panel>

        <Panel title="Pay assumptions">
          <p className="small dim" style={{ margin: '0 0 12px' }}>
            CREW ships no rate tables and knows nothing about your contract. Type your own numbers and the earnings
            screens fill in.
          </p>
          <div className="inline-fields">
            <Field label="Hourly rate">
              <input
                type="number"
                inputMode="decimal"
                value={pilot.pay.hourlyRate ?? ''}
                placeholder="—"
                onChange={(e) => updatePay({ hourlyRate: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Per diem / hour">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={pilot.pay.perDiemPerHour ?? ''}
                placeholder="—"
                onChange={(e) => updatePay({ perDiemPerHour: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Monthly guarantee (hours)">
            <input
              type="number"
              inputMode="decimal"
              value={pilot.pay.minGuaranteeHours ?? ''}
              placeholder="—"
              onChange={(e) => updatePay({ minGuaranteeHours: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
          <Advisory>
            These are your assumptions, not your contract. Always reconcile against your pay register.
          </Advisory>
        </Panel>

        <Panel title="Food & layovers">
          <Field label="Price ceiling">
            <select
              value={pilot.prefs.food.maxPrice}
              onChange={(e) =>
                updatePrefs({ food: { ...pilot.prefs.food, maxPrice: Number(e.target.value) as 1 | 2 | 3 | 4 } })
              }
            >
              <option value={1}>$ — cheap and fast</option>
              <option value={2}>$$ — solid</option>
              <option value={3}>$$$ — worth planning around</option>
              <option value={4}>$$$$ — anything</option>
            </select>
          </Field>
          <Toggle
            label="Coffee matters to me"
            on={pilot.prefs.food.coffeeMatters}
            onChange={(v) => updatePrefs({ food: { ...pilot.prefs.food, coffeeMatters: v } })}
          />
          <Toggle
            label="Prioritise MICHELIN listings"
            on={pilot.prefs.food.wantsMichelin}
            onChange={(v) => updatePrefs({ food: { ...pilot.prefs.food, wantsMichelin: v } })}
          />
          <div className="divider" />
          <div className="eyebrow" style={{ margin: '0 0 8px' }}>
            Cuisines you look for
          </div>
          <div className="chips">
            {CUISINES.map((c) => {
              const on = pilot.prefs.food.cuisines.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    updatePrefs({
                      food: {
                        ...pilot.prefs.food,
                        cuisines: on
                          ? pilot.prefs.food.cuisines.filter((x) => x !== c)
                          : [...pilot.prefs.food.cuisines, c],
                      },
                    })
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
          <div className="divider" />
          <div className="eyebrow" style={{ margin: '0 0 8px' }}>
            What you do on a layover
          </div>
          <div className="chips">
            {ACTIVITIES.map((a) => {
              const on = pilot.prefs.activities.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    updatePrefs({
                      activities: on
                        ? pilot.prefs.activities.filter((x) => x !== a.id)
                        : [...pilot.prefs.activities, a.id],
                    })
                  }
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Your fleet">
          <div className="chips">
            {AIRCRAFT.map((a) => {
              const on = pilot.fleet.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    updatePilot({
                      fleet: on ? pilot.fleet.filter((x) => x !== a.id) : [...pilot.fleet, a.id],
                    })
                  }
                >
                  {a.variant.split(' (')[0]}
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title="Flight lookup">
          <p className="small dim" style={{ margin: '0 0 12px' }}>
            Typing a flight number and a date fills in the rest. CREW checks your own trip history first — free,
            instant, and usually right for flights you already fly. It also checks live ADS-B, which can supply the
            tail number of anything airborne right now.
          </p>
          <p className="small dim" style={{ margin: '0 0 12px' }}>
            To look up any flight on any date you need a schedule provider.{' '}
            <a href="https://rapidapi.com/aedbx-aedbx/api/aerodatabox" target="_blank" rel="noreferrer noopener">
              AeroDataBox on RapidAPI
            </a>{' '}
            has a free tier. Paste the key here.
          </p>
          <Field label="AeroDataBox key" hint="Stored only in this browser and sent only to AeroDataBox.">
            <input
              type="password"
              value={state.integrations.aeroDataBoxKey ?? ''}
              placeholder="Not set"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setAeroDataBoxKey(e.target.value.trim() || null)}
            />
          </Field>
          {state.integrations.aeroDataBoxKey && (
            <button type="button" className="btn ghost" onClick={() => setAeroDataBoxKey(null)}>
              Remove key
            </button>
          )}
        </Panel>

        <Panel title="Data">
          <button type="button" className="btn ghost" style={{ marginBottom: 8 }} onClick={refreshSampleTrip}>
            Regenerate the sample pairing for today
          </button>
          {hasSample ? (
            <button type="button" className="btn ghost" style={{ marginBottom: 8 }} onClick={clearSampleData}>
              Clear sample logbook entries
            </button>
          ) : (
            <button type="button" className="btn ghost" style={{ marginBottom: 8 }} onClick={restoreSampleData}>
              Restore sample logbook
            </button>
          )}
          <button
            type="button"
            className="btn ghost"
            style={{ marginBottom: 8 }}
            onClick={() => {
              clearCache();
              alert('Cached weather cleared. It will refetch on the next screen.');
            }}
          >
            Clear cached weather
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              if (confirm('Erase everything CREW has stored on this device? This cannot be undone.')) {
                clearEverything();
              }
            }}
          >
            Erase all CREW data
          </button>
          <p className="tiny faint" style={{ marginTop: 10 }}>
            Everything CREW knows lives in this browser. Nothing is uploaded, there is no account, and clearing site
            data removes it all.
          </p>
        </Panel>

        <Panel title="About">
          <p className="small dim" style={{ margin: 0 }}>
            CREW is a personal reference app. It is not an approved EFB, flight planning system, dispatch release,
            aircraft manual or company manual, and nothing in it is an operational clearance or instruction. For
            anything that matters operationally, go to your company's systems, the FAA, and the official weather
            sources CREW links to.
          </p>
        </Panel>
      </Screen>
    </>
  );
}

function AirportPicker({
  label,
  hint,
  value,
  query,
  setQuery,
  onPick,
}: {
  label: string;
  hint?: string;
  value: string;
  query: string;
  setQuery: (v: string) => void;
  onPick: (icao: string) => void;
}) {
  const current = findAirport(value);
  const results = query.trim() ? searchAirports(query, 6) : [];

  return (
    <Field label={label} hint={hint}>
      <input
        type="search"
        value={query}
        placeholder={current ? `${current.iata} — ${current.city}` : 'Search'}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="characters"
        autoCorrect="off"
      />
      {results.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {results.map((a) => (
            <button key={a.icao} type="button" className="row" onClick={() => onPick(a.icao)}>
              <span className="mono strong" style={{ width: 46, flex: 'none' }}>
                {a.iata}
              </span>
              <span className="grow small">
                {a.name} <span className="faint">· {a.city}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
