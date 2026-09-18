import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
import { formatDuration, formatHoursDecimal } from '../../core/time/time';
import { airportVisits, fleetFromLog, logbookTotals } from '../../core/context/stats';
import { aircraftLabel, findAircraft } from '../../data/aircraft';
import { findAirport } from '../../data/airportIndex';
import { guideForAirport } from '../../data/layovers';
import { recordGameResult } from '../../store/actions';
import { useCrew } from '../../store/store';
import { Empty, Panel, RowLink, Stat, Stats } from '../../ui/primitives';
import { GENERATORS, dailyRand, type Question } from './games';

export function PlayHub() {
  const state = useCrew();
  const daily = useMemo(() => {
    const rand = dailyRand();
    const gen = GENERATORS[Math.floor(rand() * GENERATORS.length) % GENERATORS.length];
    return { gen, question: gen.make(rand) };
  }, []);

  const totalPlayed = Object.values(state.games).reduce((n, g) => n + g.played, 0);
  const totalCorrect = Object.values(state.games).reduce((n, g) => n + g.correct, 0);
  const bestStreak = Object.values(state.games).reduce((n, g) => Math.max(n, g.bestStreak), 0);

  return (
    <>
      <TopBar title="Play" />
      <Screen>
        <Panel title="Daily challenge" className="accent">
          <div className="small dim" style={{ marginBottom: 10 }}>
            {daily.gen.name} — the same question for everyone today.
          </div>
          <Link className="btn primary" to={`/play/${daily.gen.id}?daily=1`}>
            Play today's
          </Link>
        </Panel>

        {totalPlayed > 0 && (
          <Panel title="Your record">
            <Stats>
              <Stat k="Played" v={totalPlayed} />
              <Stat k="Correct" v={`${Math.round((totalCorrect / totalPlayed) * 100)}%`} tone="accent" />
              <Stat k="Best streak" v={bestStreak} />
            </Stats>
          </Panel>
        )}

        <Panel title="Games">
          {GENERATORS.map((g) => {
            const s = state.games[g.id];
            return (
              <RowLink key={g.id} to={`/play/${g.id}`}>
                <div className="strong">{g.name}</div>
                <div className="tiny faint">
                  {g.blurb}
                  {s ? ` · ${s.correct}/${s.played}` : ''}
                </div>
              </RowLink>
            );
          })}
        </Panel>

        <Panel title="Your aviation history">
          <RowLink to="/play/history">
            <div className="strong">Fleet, airports, cities, flights</div>
            <div className="tiny faint">Everything you have actually flown</div>
          </RowLink>
        </Panel>
      </Screen>
    </>
  );
}

export function GameScreen() {
  const { game = '' } = useParams();
  const gen = GENERATORS.find((g) => g.id === game);
  const isDaily = new URLSearchParams(window.location.search).get('daily') === '1';

  const makeQuestion = useCallback(() => {
    if (!gen) return null;
    return isDaily ? gen.make(dailyRand()) : gen.make();
  }, [gen, isDaily]);

  const [question, setQuestion] = useState<Question | null>(makeQuestion);
  const [chosen, setChosen] = useState<number | null>(null);
  const [round, setRound] = useState(1);

  if (!gen || !question) {
    return (
      <>
        <TopBar title="Play" back />
        <Screen>
          <Empty glyph="◆" title="Unknown game">
            <Link to="/play">Back to Play</Link>
          </Empty>
        </Screen>
      </>
    );
  }

  const answered = chosen !== null;
  const correct = answered && chosen === question.answerIndex;

  const choose = (i: number) => {
    if (answered) return;
    setChosen(i);
    recordGameResult(gen.id, i === question.answerIndex);
  };

  const next = () => {
    setQuestion(gen.make());
    setChosen(null);
    setRound((r) => r + 1);
  };

  return (
    <>
      <TopBar title={gen.name} back />
      <Screen>
        <Panel className="accent">
          <div className="eyebrow" style={{ margin: '0 0 6px' }}>
            {isDaily ? "Today's challenge" : `Round ${round}`}
          </div>
          <div className="big" style={{ fontSize: 20, lineHeight: 1.3 }}>
            {question.prompt}
          </div>
          {question.detail && (
            <div className="small mono dim" style={{ marginTop: 8 }}>
              {question.detail}
            </div>
          )}
        </Panel>

        {question.options.map((opt, i) => {
          const isAnswer = i === question.answerIndex;
          const tone = !answered ? '' : isAnswer ? ' primary' : i === chosen ? ' danger' : ' ghost';
          return (
            <button
              key={opt}
              type="button"
              className={`btn${tone}`}
              style={{ marginBottom: 8, justifyContent: 'flex-start' }}
              onClick={() => choose(i)}
              disabled={answered}
            >
              {answered && isAnswer ? '✓ ' : answered && i === chosen ? '✕ ' : ''}
              {opt}
            </button>
          );
        })}

        {answered && (
          <Panel title={correct ? 'Correct' : 'Not quite'} className={correct ? '' : 'caution'}>
            <p className="small dim" style={{ margin: 0 }}>
              {question.explanation}
            </p>
            {question.link && (
              <>
                <div className="divider" />
                <Link className="btn ghost" to={question.link.to}>
                  {question.link.label}
                </Link>
              </>
            )}
            {!isDaily && (
              <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={next}>
                Next question
              </button>
            )}
          </Panel>
        )}
      </Screen>
    </>
  );
}

/** My Fleet / My Airports / My Cities / My Flights. */
export function History() {
  const state = useCrew();
  const [tab, setTab] = useState<'fleet' | 'airports' | 'cities' | 'flights'>('fleet');

  const totals = useMemo(() => logbookTotals(state.flights, state.tails), [state.flights, state.tails]);
  const fleet = useMemo(() => fleetFromLog(state.flights, state.tails), [state.flights, state.tails]);
  const visits = useMemo(() => airportVisits(state.flights), [state.flights]);
  const cities = useMemo(() => {
    const map = new Map<string, { city: string; guideKey: string | null; visits: number }>();
    for (const v of visits) {
      const ap = findAirport(v.icao);
      if (!ap) continue;
      const guide = guideForAirport(ap.icao);
      const key = ap.city;
      const e = map.get(key) ?? { city: ap.city, guideKey: guide?.key ?? null, visits: 0 };
      e.visits += v.visits;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.visits - a.visits);
  }, [visits]);

  return (
    <>
      <TopBar title="Your history" back />
      <Screen>
        <Stats>
          <Stat k="Flights" v={totals.flights} />
          <Stat k="Hours" v={formatHoursDecimal(totals.blockMinutes)} />
          <Stat k="Airports" v={totals.airports} />
          <Stat k="Airframes" v={fleet.filter((f) => f.flights > 0).length} />
        </Stats>

        <div className="scroller" style={{ margin: '14px 0 12px' }}>
          {(['fleet', 'airports', 'cities', 'flights'] as const).map((t) => (
            <button key={t} type="button" className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t === 'fleet' ? 'My fleet' : t === 'airports' ? 'My airports' : t === 'cities' ? 'My cities' : 'My flights'}
            </button>
          ))}
        </div>

        {tab === 'fleet' && (
          <Panel className="flush">
            <div className="list inset">
              {fleet.length === 0 && <Empty glyph="✈" title="No airframes logged yet" />}
              {fleet.map((f) => {
                const spec = findAircraft(f.aircraftId);
                return (
                  <Link key={f.tail} className="row" to={`/deck/aircraft/${f.aircraftId}`}>
                    <span className="mono strong" style={{ width: 74, flex: 'none' }}>
                      {f.tail}
                    </span>
                    <div className="grow small">
                      <div>{aircraftLabel(f.aircraftId)}</div>
                      <div className="tiny faint mono">
                        {f.flights} flights · {formatDuration(f.blockMinutes)}
                        {f.first ? ` · first ${f.first}` : ''}
                      </div>
                      {spec && <div className="tiny faint">{spec.engines.model}</div>}
                    </div>
                    <span className="chev">›</span>
                  </Link>
                );
              })}
            </div>
          </Panel>
        )}

        {tab === 'airports' && (
          <Panel className="flush">
            <div className="list inset">
              {visits.length === 0 && <Empty glyph="◇" title="No airports logged yet" />}
              {visits.map((v) => (
                <Link key={v.icao} className="row" to={`/deck/airport/${v.icao}`}>
                  <span className="mono strong" style={{ width: 46, flex: 'none' }}>
                    {v.iata}
                  </span>
                  <div className="grow small">
                    <div>{v.city}</div>
                    <div className="tiny faint mono">
                      {v.visits} visits · {v.first} → {v.last}
                    </div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'cities' && (
          <Panel className="flush">
            <div className="list inset">
              {cities.length === 0 && <Empty glyph="◉" title="No cities yet" />}
              {cities.map((c) => (
                <div key={c.city} className="row">
                  <div className="grow small">
                    <div className="strong">{c.city}</div>
                    <div className="tiny faint">{c.visits} times through</div>
                  </div>
                  {c.guideKey && (
                    <Link className="chip" to={`/layover/${c.guideKey}`}>
                      Guide ›
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'flights' && (
          <Panel className="flush">
            <div className="list inset">
              {state.flights.length === 0 && <Empty glyph="▤" title="No flights logged yet" />}
              {state.flights.slice(0, 80).map((f) => (
                <div key={f.id} className="row">
                  <span className="mono small faint" style={{ width: 74, flex: 'none' }}>
                    {f.date}
                  </span>
                  <div className="grow small">
                    <span className="mono strong">
                      {findAirport(f.from)?.iata ?? f.from} → {findAirport(f.to)?.iata ?? f.to}
                    </span>
                    <div className="tiny faint mono">
                      {aircraftLabel(f.aircraftId)}
                      {f.tail ? ` · ${f.tail}` : ''}
                      {f.sample ? ' · sample' : ''}
                    </div>
                  </div>
                  <span className="mono">{formatDuration(f.blockMinutes)}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </Screen>
    </>
  );
}
