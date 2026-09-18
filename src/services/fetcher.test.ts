import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, freshnessLabel, getJson } from './fetcher';
import { flightCategory, isSignificant, nextSignificantWindow, weatherCodeLabel } from './weather';
import type { AirportForecast } from './weather';

/** A localStorage stand-in, since these tests run outside a browser. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
}

const SOURCE = { name: 'Test source', url: 'https://example.test', kind: 'reference' as const };

const opts = (overrides: Partial<Parameters<typeof getJson>[0]> = {}) => ({
  key: 'test-key',
  url: 'https://example.test/data',
  source: SOURCE,
  ttlMs: 60_000,
  parse: (raw: unknown) => (raw as { value: number }).value,
  ...overrides,
});

describe('getJson', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns parsed data with provenance on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ value: 42 }), { status: 200 })));
    const r = await getJson(opts());
    expect(r.data).toBe(42);
    expect(r.error).toBeNull();
    expect(r.stale).toBe(false);
    expect(r.source.name).toBe('Test source');
    expect(r.fetchedAt).toBeGreaterThan(0);
  });

  it('serves a fresh cached value without hitting the network again', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ value: 7 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await getJson(opts());
    const second = await getJson(opts());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.data).toBe(7);
    expect(second.stale).toBe(false);
  });

  it('falls back to cached data and flags it stale when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ value: 11 }), { status: 200 })));
    await getJson(opts());

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));
    // Zero TTL forces a refetch attempt against the dead network.
    const r = await getJson(opts({ ttlMs: 0 }));
    expect(r.data).toBe(11);
    expect(r.stale).toBe(true);
    expect(r.error).toBe('Network down');
    expect(r.fetchedAt).toBeGreaterThan(0);
  });

  it('returns null data rather than inventing a value when there is no cache', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Network down');
    }));
    const r = await getJson(opts({ key: 'never-cached' }));
    expect(r.data).toBeNull();
    expect(r.error).toBe('Network down');
    expect(r.fetchedAt).toBeNull();
  });

  it('treats a non-200 as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const r = await getJson(opts({ key: 'bad-status' }));
    expect(r.data).toBeNull();
    expect(r.error).toBe('HTTP 503');
  });

  it('survives a response whose shape the parser rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ wrong: true }), { status: 200 })));
    const r = await getJson(
      opts({
        key: 'bad-shape',
        parse: () => {
          throw new Error('Unexpected shape');
        },
      }),
    );
    expect(r.data).toBeNull();
    expect(r.error).toBe('Unexpected shape');
  });

  it('keeps working when localStorage throws', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ value: 5 }), { status: 200 })));
    const r = await getJson(opts({ key: 'private-mode' }));
    expect(r.data).toBe(5);
  });
});

describe('freshnessLabel', () => {
  it('describes age in the units a person would use', () => {
    const now = 1_700_000_000_000;
    expect(freshnessLabel(null)).toBe('not loaded');
    expect(freshnessLabel(now, now)).toBe('just now');
    expect(freshnessLabel(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(freshnessLabel(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(freshnessLabel(now - 48 * 3_600_000, now)).toBe('2d ago');
  });
});

describe('weather helpers', () => {
  it('labels WMO codes and flags the significant ones', () => {
    expect(weatherCodeLabel(0)).toBe('Clear');
    expect(weatherCodeLabel(95)).toBe('Thunderstorm');
    expect(weatherCodeLabel(null)).toBe('Unknown');
    expect(weatherCodeLabel(9999)).toBe('Code 9999');
    expect(isSignificant(0)).toBe(false);
    expect(isSignificant(95)).toBe(true);
    expect(isSignificant(45)).toBe(true);
    expect(isSignificant(null)).toBe(false);
  });

  it('derives flight category the way the AWC does', () => {
    expect(flightCategory(10, 5000)).toBe('VFR');
    expect(flightCategory(4, 2000)).toBe('MVFR');
    expect(flightCategory(2, 800)).toBe('IFR');
    expect(flightCategory(0.5, 200)).toBe('LIFR');
    expect(flightCategory(null, null)).toBeNull();
  });

  it('finds the next window of significant weather', () => {
    const from = new Date('2026-09-18T12:00:00Z');
    const hour = (h: number, code: number, prob: number) => ({
      time: new Date(from.getTime() + h * 3_600_000).toISOString(),
      tempC: 20,
      windKt: 8,
      gustKt: null,
      windDirDeg: 180,
      precipProbability: prob,
      precipMm: 0,
      cloudCoverPct: 50,
      visibilityM: 10000,
      weatherCode: code,
    });
    const forecast: AirportForecast = {
      current: null,
      tz: 'UTC',
      hourly: [hour(0, 0, 5), hour(1, 0, 10), hour(2, 61, 70), hour(3, 61, 80), hour(4, 0, 10)],
    };
    const w = nextSignificantWindow(forecast, from, 12)!;
    expect(w.label).toBe('Light rain');
    expect(new Date(w.start).getUTCHours()).toBe(14);
    expect(new Date(w.end).getUTCHours()).toBe(15);
  });

  it('returns nothing when the forecast is clear or missing', () => {
    const from = new Date('2026-09-18T12:00:00Z');
    expect(nextSignificantWindow(null, from)).toBeNull();
    expect(
      nextSignificantWindow(
        { current: null, tz: 'UTC', hourly: [{ time: from.toISOString(), tempC: 20, windKt: 5, gustKt: null, windDirDeg: 0, precipProbability: 0, precipMm: 0, cloudCoverPct: 0, visibilityM: 10000, weatherCode: 0 }] },
        from,
      ),
    ).toBeNull();
  });
});
