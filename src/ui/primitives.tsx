/** Shared UI primitives. Presentation only — no data fetching, no business logic. */

import { Children, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Source } from '../core/types';
import { freshnessLabel } from '../services/fetcher';

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ k, v, sub, tone }: { k: string; v: ReactNode; sub?: string; tone?: 'go' | 'caution' | 'warn' | 'accent' }) {
  const toneClass = tone ? ` ${tone === 'accent' ? 'accent-text' : tone === 'go' ? 'go' : tone === 'caution' ? 'caution-text' : 'warn-text'}` : '';
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className={`v${toneClass}`}>{v}</div>
      {sub && <div className="tiny faint">{sub}</div>}
    </div>
  );
}

/**
 * A row of stats.
 *
 * Column count is picked from how many stats there are so the last row is
 * never a lone cell next to dead space — four stats become 2x2, not 3+1.
 */
export function Stats({ children }: { children: ReactNode }) {
  const count = Children.toArray(children).filter(Boolean).length;
  const cols = count <= 3 ? Math.max(1, count) : count % 3 === 0 ? 3 : count % 2 === 0 ? 2 : 3;
  return (
    <div className="stats" style={{ ['--stat-cols' as string]: String(cols) }}>
      {children}
    </div>
  );
}

export function RowLink({
  to,
  href,
  onClick,
  children,
}: {
  to?: string;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const content = (
    <>
      <div className="grow">{children}</div>
      <span className="chev" aria-hidden>
        ›
      </span>
    </>
  );
  if (to) {
    return (
      <Link className="row" to={to}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a className="row" href={href} target="_blank" rel="noreferrer noopener">
        {content}
      </a>
    );
  }
  return (
    <button className="row" type="button" onClick={onClick}>
      {content}
    </button>
  );
}

/** "Where did this come from?" — rendered wherever external data appears. */
export function SourceLinks({ sources, label }: { sources: Source[]; label?: string }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources">
      {label && <span className="tiny faint" style={{ alignSelf: 'center', marginRight: 2 }}>{label}</span>}
      {sources.map((s) =>
        s.url ? (
          <a key={s.name + s.url} className="source-link" href={s.url} target="_blank" rel="noreferrer noopener">
            <span className="glyph" aria-hidden>
              ↗
            </span>
            {s.name}
            {s.asOf ? ` · ${s.asOf}` : ''}
          </a>
        ) : (
          <span key={s.name} className="source-link">
            {s.name}
          </span>
        ),
      )}
    </div>
  );
}

/** Freshness + failure state for anything fetched over the network. */
export function Provenance({
  sourceName,
  fetchedAt,
  stale,
  error,
  now,
}: {
  sourceName: string;
  fetchedAt: number | null;
  stale: boolean;
  error: string | null;
  now?: number;
}) {
  const cls = error && !fetchedAt ? 'failed' : stale ? 'stale' : '';
  const text = error && !fetchedAt
    ? `${sourceName} unavailable — ${error}`
    : stale
      ? `${sourceName} · cached ${freshnessLabel(fetchedAt, now)} · could not refresh`
      : `${sourceName} · ${freshnessLabel(fetchedAt, now)}`;
  return (
    <div className={`provenance ${cls}`}>
      <span className="dot" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

/**
 * The operational boundary, stated wherever CREW shows something that could
 * be mistaken for an approved source.
 */
export function Advisory({ children }: { children: ReactNode }) {
  return (
    <p className="advisory">
      <strong>Reference only.</strong> {children}
    </p>
  );
}

export function Empty({ glyph, title, children }: { glyph: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="glyph" aria-hidden>
        {glyph}
      </span>
      <div className="strong" style={{ color: 'var(--text-dim)' }}>
        {title}
      </div>
      {children && <div className="small" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <span className="small">{label}</span>
      <button
        type="button"
        className={`switch ${on ? 'on' : ''}`}
        aria-pressed={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
