/**
 * The only place in CREW that talks to the network.
 *
 * Every external call returns an envelope that says where the data came from,
 * when it was fetched, and whether what you are looking at is stale. UI
 * components must never call fetch directly — if an adapter is missing,
 * add one here.
 */

import type { Source } from '../core/types';

export interface Fetched<T> {
  data: T | null;
  source: Source;
  fetchedAt: number | null;
  /** True when this came from cache past its freshness window. */
  stale: boolean;
  /** Present when the live call failed. Data may still be a cached value. */
  error: string | null;
}

interface CacheEntry {
  at: number;
  value: unknown;
}

const CACHE_PREFIX = 'crew.cache.';
const memory = new Map<string, CacheEntry>();

function readCache(key: string): CacheEntry | null {
  const hit = memory.get(key);
  if (hit) return hit;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown): void {
  const entry: CacheEntry = { at: Date.now(), value };
  memory.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — the in-memory cache still works.
  }
}

export function clearCache(): void {
  memory.clear();
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export interface GetOptions<T> {
  key: string;
  url: string;
  source: Source;
  /** How long a cached value counts as fresh, in milliseconds. */
  ttlMs: number;
  parse: (raw: unknown) => T;
  timeoutMs?: number;
}

/**
 * Cache-first-then-network with graceful failure.
 *
 * On a network failure we return the cached value flagged stale rather than
 * nothing — a pilot on hotel wifi would rather see this morning's METAR
 * labelled as old than an empty screen. We never substitute made-up data.
 */
export async function getJson<T>(opts: GetOptions<T>): Promise<Fetched<T>> {
  const cached = readCache(opts.key);
  const fresh = cached && Date.now() - cached.at < opts.ttlMs;

  if (fresh) {
    try {
      return { data: opts.parse(cached!.value), source: opts.source, fetchedAt: cached!.at, stale: false, error: null };
    } catch {
      // Cached shape no longer parses — fall through and refetch.
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(opts.url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as unknown;
    writeCache(opts.key, raw);
    return { data: opts.parse(raw), source: opts.source, fetchedAt: Date.now(), stale: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? (err.name === 'AbortError' ? 'Request timed out' : err.message) : 'Request failed';
    if (cached) {
      try {
        return { data: opts.parse(cached.value), source: opts.source, fetchedAt: cached.at, stale: true, error: message };
      } catch {
        /* cached value unusable */
      }
    }
    return { data: null, source: opts.source, fetchedAt: null, stale: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Same contract, for endpoints that hand back text rather than JSON. */
export async function getText<T>(opts: Omit<GetOptions<T>, 'parse'> & { parse: (raw: string) => T }): Promise<Fetched<T>> {
  const cached = readCache(opts.key);
  const fresh = cached && Date.now() - cached.at < opts.ttlMs;
  if (fresh) {
    try {
      return { data: opts.parse(cached!.value as string), source: opts.source, fetchedAt: cached!.at, stale: false, error: null };
    } catch {
      /* refetch */
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await fetch(opts.url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    writeCache(opts.key, raw);
    return { data: opts.parse(raw), source: opts.source, fetchedAt: Date.now(), stale: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? (err.name === 'AbortError' ? 'Request timed out' : err.message) : 'Request failed';
    if (cached) {
      try {
        return { data: opts.parse(cached.value as string), source: opts.source, fetchedAt: cached.at, stale: true, error: message };
      } catch {
        /* unusable */
      }
    }
    return { data: null, source: opts.source, fetchedAt: null, stale: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** "3 min ago" / "yesterday" for the provenance line under fetched data. */
export function freshnessLabel(fetchedAt: number | null, now = Date.now()): string {
  if (!fetchedAt) return 'not loaded';
  const mins = Math.round((now - fetchedAt) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
