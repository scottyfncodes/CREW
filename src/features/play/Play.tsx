import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen, TopBar } from '../../app/AppShell';
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
      <TopBar title="Games" back />
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

        <div className="tiny faint" style={{ textAlign: 'center', margin: '4px 0 12px' }}>
          Your fleet, airports and flights live in <Link to="/logbook">Logbook</Link>.
        </div>
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

