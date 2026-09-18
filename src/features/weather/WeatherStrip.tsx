import type { Airport } from '../../core/types';
import { timeIn } from '../../core/time/time';
import { Provenance } from '../../ui/primitives';
import { isSignificant, weatherCodeLabel, type AirportForecast } from '../../services/weather';
import type { Fetched } from '../../services/fetcher';

/** Twelve hours of forecast in a strip, starting from `from`. */
export function WeatherStrip({
  airport,
  result,
  from,
  hours = 12,
  step = 2,
}: {
  airport: Airport;
  result: Fetched<AirportForecast> | null;
  from: Date;
  hours?: number;
  step?: number;
}) {
  if (!result) return <div className="small faint">Loading weather…</div>;
  if (!result.data) {
    return (
      <>
        <div className="small faint">Forecast unavailable right now.</div>
        <Provenance sourceName={result.source.name} fetchedAt={result.fetchedAt} stale={result.stale} error={result.error} />
      </>
    );
  }

  const start = from.getTime();
  const points = result.data.hourly
    .filter((p) => {
      const t = new Date(p.time).getTime();
      return !Number.isNaN(t) && t >= start - 30 * 60_000 && t <= start + hours * 3_600_000;
    })
    .filter((_, i) => i % step === 0)
    .slice(0, 7);

  if (points.length === 0) {
    return <div className="small faint">No forecast hours in this window.</div>;
  }

  return (
    <>
      <div className="wx-strip">
        {points.map((p) => {
          const wet = isSignificant(p.weatherCode) || (p.precipProbability ?? 0) >= 50;
          return (
            <div key={p.time} className={`wx-hour${wet ? ' wet' : ''}`}>
              <div className="h">{timeIn(p.time, airport.tz)}</div>
              <div className="t">{p.tempC === null ? '—' : `${Math.round(p.tempC)}°`}</div>
              <div className="p">{p.precipProbability === null ? '' : `${p.precipProbability}%`}</div>
            </div>
          );
        })}
      </div>
      <Provenance sourceName={result.source.name} fetchedAt={result.fetchedAt} stale={result.stale} error={result.error} />
    </>
  );
}

/**
 * One-line current conditions. Returns null when there is nothing to say, so
 * callers can drop the whole row rather than print an empty dash.
 */
export function WeatherLine({ result }: { result: Fetched<AirportForecast> | null }) {
  if (!result?.data?.current) return null;
  const c = result.data.current;
  const parts: string[] = [weatherCodeLabel(c.weatherCode)];
  if (c.tempC !== null) parts.push(`${Math.round(c.tempC)}°C`);
  if (c.windKt !== null && c.windDirDeg !== null) {
    parts.push(`${String(Math.round(c.windDirDeg)).padStart(3, '0')}° / ${Math.round(c.windKt)} kt`);
  }
  if (c.gustKt !== null && c.windKt !== null && c.gustKt > c.windKt + 5) {
    parts.push(`G${Math.round(c.gustKt)}`);
  }
  return <span>{parts.join(' · ')}</span>;
}
