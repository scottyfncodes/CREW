import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Today', glyph: '◈' },
  { to: '/deck', label: 'Deck', glyph: '✈' },
  { to: '/layover', label: 'Layover', glyph: '◉' },
  { to: '/offduty', label: 'Off Duty', glyph: '▤' },
  { to: '/play', label: 'Play', glyph: '◆' },
];

export function BottomNav() {
  return (
    <nav className="nav" aria-label="Primary">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <span className="glyph" aria-hidden>
            {t.glyph}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function TopBar({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button type="button" className="back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {action}
    </header>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return <main className="screen">{children}</main>;
}
