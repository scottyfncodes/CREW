import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

/**
 * Four tabs: Today / Schedule / Logbook / Tools. Layover and flight detail
 * are reached contextually from Today and Schedule, not from the nav.
 *
 * A handful of older routes (aircraft/airport reference, calculators, pay,
 * games, settings) still live at their original top-level paths rather than
 * under /tools — moving them would touch every internal link in those
 * screens for no user-visible benefit. `match` is how the Tools tab still
 * highlights correctly while a pilot is inside one of them.
 */
const TABS: { to: string; label: string; glyph: string; match: (path: string) => boolean }[] = [
  { to: '/', label: 'Today', glyph: '◈', match: (p) => p === '/' },
  { to: '/schedule', label: 'Schedule', glyph: '▤', match: (p) => p.startsWith('/schedule') },
  { to: '/logbook', label: 'Logbook', glyph: '✎', match: (p) => p.startsWith('/logbook') },
  {
    to: '/tools',
    label: 'Tools',
    glyph: '✈',
    match: (p) =>
      p.startsWith('/tools') ||
      p.startsWith('/deck') ||
      p.startsWith('/layover') ||
      p.startsWith('/offduty') ||
      p.startsWith('/play') ||
      p.startsWith('/settings'),
  },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="nav" aria-label="Primary">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to} className={t.match(pathname) ? 'active' : ''}>
          <span className="glyph" aria-hidden>
            {t.glyph}
          </span>
          {t.label}
        </Link>
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
