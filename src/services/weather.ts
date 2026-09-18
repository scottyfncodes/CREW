/**
 * Weather adapters.
 *
 * CREW shows weather as situational awareness, not as an operational decision
 * product. Forecast comes from Open-Meteo; observations and forecasts in
 * aviation format come from the NWS Aviation Weather Center. Both are linked
 * so the pilot can go to the source, and neither replaces the official
 * briefing package.
 */

import type { Airport, Source } from '../core/types';
import { getJson, type Fetched } from './fetcher';

export interface HourlyPoint {
  time: string; // ISO with the airport's local offset, as returned
  tempC: number | null;
  windKt: number | null;
  gustKt: number | null;
  windDirDeg: number | null;
  precipProbability: number | null;
  precipMm: number | null;
  cloudCoverPct: number | null;
  visibilityM: number | null;
  weatherCode: number | null;
}

export interface AirportForecast {
  current: HourlyPoint | null;
  hourly: HourlyPoint[];
  tz: string;
}

const OPEN_METEO: Source = {
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
  kind: 'reference',
};

const AWC: Source = {
  name: 'NWS Aviation Weather Center',
  url: 'https://aviationweather.gov/',
  kind: 'official',
};

/** WMO weather code -> a short phrase. Codes are from the Open-Meteo docs. */
export function weatherCodeLabel(code: number | null): string {
  if (code === null) return 'Unknown';
  const table: Record<number, string> = {
    0: 'Clear',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Freezing fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Violent rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with hail',
  };
  return table[code] ?? `Code ${code}`;
}

/** Weather codes that matter operationally enough to call out. */
export function isSignificant(code: number | null): boolean {
  if (code === null) return false;
  return code >= 45 && code !== 51 && code !== 53;
}

interface OpenMeteoRaw {
  timezone?: string;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown[]>;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function fetchForecast(airport: Airport, days = 3): Promise<Fetched<AirportForecast>> {
  const params = new URLSearchParams({
    latitude: String(airport.pos.lat),
    longitude: String(airport.pos.lon),
    hourly:
      'temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    current: 'temperature_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    wind_speed_unit: 'kn',
    temperature_unit: 'celsius',
    timezone: airport.tz,
    forecast_days: String(days),
  });

  return getJson<AirportForecast>({
    key: `wx.forecast.${airport.icao}.${days}`,
    url: `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    source: {
      ...OPEN_METEO,
      url: `https://open-meteo.com/en/docs#latitude=${airport.pos.lat}&longitude=${airport.pos.lon}`,
    },
    ttlMs: 20 * 60_000,
    parse: (raw) => {
      const r = raw as OpenMeteoRaw;
      const h = r.hourly ?? {};
      const times = (h.time as string[] | undefined) ?? [];
      const hourly: HourlyPoint[] = times.map((t, i) => ({
        time: t,
        tempC: num(h.temperature_2m?.[i]),
        windKt: num(h.wind_speed_10m?.[i]),
        gustKt: num(h.wind_gusts_10m?.[i]),
        windDirDeg: num(h.wind_direction_10m?.[i]),
        precipProbability: num(h.precipitation_probability?.[i]),
        precipMm: num(h.precipitation?.[i]),
        cloudCoverPct: num(h.cloud_cover?.[i]),
        visibilityM: num(h.visibility?.[i]),
        weatherCode: num(h.weather_code?.[i]),
      }));
      const c = r.current;
      const current: HourlyPoint | null = c
        ? {
            time: String(c.time ?? ''),
            tempC: num(c.temperature_2m),
            windKt: num(c.wind_speed_10m),
            gustKt: num(c.wind_gusts_10m),
            windDirDeg: num(c.wind_direction_10m),
            precipProbability: null,
            precipMm: null,
            cloudCoverPct: num(c.cloud_cover),
            visibilityM: null,
            weatherCode: num(c.weather_code),
          }
        : null;
      return { current, hourly, tz: r.timezone ?? airport.tz };
    },
  });
}

export interface Metar {
  icao: string;
  raw: string;
  observedAt: string | null;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | null;
  windKt: number | null;
  gustKt: number | null;
  visibilitySm: number | null;
  altimeterInHg: number | null;
  flightCategory: string | null;
}

interface AwcMetarRaw {
  icaoId?: string;
  rawOb?: string;
  obsTime?: number;
  reportTime?: string;
  temp?: number;
  dewp?: number;
  wdir?: number | string;
  wspd?: number;
  wgst?: number;
  visib?: number | string;
  altim?: number;
}

/** Derive the flight category the same way the AWC does. */
export function flightCategory(visSm: number | null, ceilingFt: number | null): string | null {
  if (visSm === null && ceilingFt === null) return null;
  const v = visSm ?? 99;
  const c = ceilingFt ?? 99999;
  if (v < 1 || c < 500) return 'LIFR';
  if (v < 3 || c < 1000) return 'IFR';
  if (v <= 5 || c <= 3000) return 'MVFR';
  return 'VFR';
}

export async function fetchMetar(icao: string): Promise<Fetched<Metar>> {
  const id = icao.toUpperCase();
  return getJson<Metar>({
    key: `wx.metar.${id}`,
    url: `https://aviationweather.gov/api/data/metar?ids=${id}&format=json`,
    source: { ...AWC, url: `https://aviationweather.gov/data/metar/?id=${id}&hours=0` },
    ttlMs: 8 * 60_000,
    parse: (raw) => {
      const arr = Array.isArray(raw) ? (raw as AwcMetarRaw[]) : [];
      const m = arr[0];
      if (!m) throw new Error('No observation');
      const visRaw = m.visib;
      const visibilitySm =
        typeof visRaw === 'number'
          ? visRaw
          : typeof visRaw === 'string'
            ? Number(visRaw.replace('+', ''))
            : null;
      // Altimeter comes back in hPa from this endpoint.
      const altimeterInHg = typeof m.altim === 'number' ? m.altim * 0.029529983 : null;
      return {
        icao: m.icaoId ?? id,
        raw: m.rawOb ?? '',
        observedAt: m.reportTime ?? (m.obsTime ? new Date(m.obsTime * 1000).toISOString() : null),
        tempC: num(m.temp),
        dewpointC: num(m.dewp),
        windDirDeg: typeof m.wdir === 'number' ? m.wdir : null,
        windKt: num(m.wspd),
        gustKt: num(m.wgst),
        visibilitySm: Number.isFinite(visibilitySm) ? (visibilitySm as number) : null,
        altimeterInHg,
        flightCategory: flightCategory(Number.isFinite(visibilitySm) ? (visibilitySm as number) : null, null),
      };
    },
  });
}

export interface Taf {
  icao: string;
  raw: string;
  issuedAt: string | null;
}

export async function fetchTaf(icao: string): Promise<Fetched<Taf>> {
  const id = icao.toUpperCase();
  return getJson<Taf>({
    key: `wx.taf.${id}`,
    url: `https://aviationweather.gov/api/data/taf?ids=${id}&format=json`,
    source: { ...AWC, url: `https://aviationweather.gov/data/taf/?id=${id}` },
    ttlMs: 30 * 60_000,
    parse: (raw) => {
      const arr = Array.isArray(raw) ? (raw as { icaoId?: string; rawTAF?: string; issueTime?: string }[]) : [];
      const t = arr[0];
      if (!t) throw new Error('No TAF');
      return { icao: t.icaoId ?? id, raw: t.rawTAF ?? '', issuedAt: t.issueTime ?? null };
    },
  });
}

/** Official links for an airport — always offered alongside CREW's own view. */
export function officialWeatherLinks(icao: string): Source[] {
  const id = icao.toUpperCase();
  return [
    { name: `METAR/TAF for ${id} (AWC)`, url: `https://aviationweather.gov/data/metar/?id=${id}&hours=12&taf=true`, kind: 'official' },
    { name: 'AWC graphical forecasts', url: 'https://aviationweather.gov/gfa/', kind: 'official' },
    { name: '1800wxbrief (official briefing)', url: 'https://www.1800wxbrief.com/', kind: 'official' },
  ];
}

/**
 * Find the next window of significant weather in a forecast, for the
 * contextual line like "rain likely 14:00-16:00".
 */
export function nextSignificantWindow(
  forecast: AirportForecast | null,
  from: Date,
  withinHours = 18,
): { start: string; end: string; label: string } | null {
  if (!forecast) return null;
  const limit = from.getTime() + withinHours * 3_600_000;
  let start: string | null = null;
  let end: string | null = null;
  let label = '';

  for (const p of forecast.hourly) {
    const t = new Date(p.time).getTime();
    if (Number.isNaN(t) || t < from.getTime() || t > limit) continue;
    const significant =
      isSignificant(p.weatherCode) || (p.precipProbability !== null && p.precipProbability >= 50);
    if (significant && !start) {
      start = p.time;
      label = weatherCodeLabel(p.weatherCode);
    }
    if (significant) end = p.time;
    if (!significant && start) break;
  }

  if (!start || !end) return null;
  return { start, end, label };
}
