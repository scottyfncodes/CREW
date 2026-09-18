import { describe, expect, it } from 'vitest';
import { AIRCRAFT, findAircraft } from './aircraft';
import { AIRPORTS, findAirport, longestRunwayFt, runwayEnds, searchAirports } from './airportIndex';
import { LAYOVER_GUIDES, fallbackLinks, findPlace, guideForAirport } from './layovers';

/**
 * These guard the promise CREW makes to the pilot: nothing is shown without a
 * source, nothing is silently wrong, and nothing is fabricated.
 */

describe('airport dataset', () => {
  it('has unique ICAO and IATA codes', () => {
    expect(new Set(AIRPORTS.map((a) => a.icao)).size).toBe(AIRPORTS.length);
    expect(new Set(AIRPORTS.map((a) => a.iata)).size).toBe(AIRPORTS.length);
  });

  it('has plausible coordinates and elevations', () => {
    for (const a of AIRPORTS) {
      expect(Math.abs(a.pos.lat), a.icao).toBeLessThanOrEqual(90);
      expect(Math.abs(a.pos.lon), a.icao).toBeLessThanOrEqual(180);
      expect(a.elevationFt, a.icao).toBeGreaterThan(-1500);
      expect(a.elevationFt, a.icao).toBeLessThan(15000);
    }
  });

  it('carries a resolvable IANA timezone for every field', () => {
    for (const a of AIRPORTS) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: a.tz }), a.icao).not.toThrow();
    }
  });

  it('links every airport to a verifiable source', () => {
    for (const a of AIRPORTS) {
      expect(a.sources.length, a.icao).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url, `${a.icao} ${s.name}`).toMatch(/^https:\/\//);
    }
  });

  it('has sane runway dimensions', () => {
    for (const a of AIRPORTS) {
      for (const r of a.runways) {
        expect(r.lengthFt, `${a.icao} ${r.ident}`).toBeGreaterThan(1000);
        expect(r.lengthFt, `${a.icao} ${r.ident}`).toBeLessThan(20000);
        expect(r.ident, a.icao).toMatch(/^\d{2}[LCR]?(\/\d{2}[LCR]?)?$/);
      }
    }
  });

  it('derives both usable directions from each runway', () => {
    const clt = findAirport('CLT')!;
    const ends = runwayEnds(clt);
    expect(ends.length).toBe(clt.runways.length * 2);
    const idents = ends.map((e) => e.ident);
    expect(idents).toContain('18L');
    expect(idents).toContain('36R');
    const l18 = ends.find((e) => e.ident === '18L')!;
    const r36 = ends.find((e) => e.ident === '36R')!;
    expect(Math.abs(l18.headingDeg - r36.headingDeg)).toBe(180);
  });

  it('resolves ICAO, IATA and bare US codes', () => {
    expect(findAirport('KCLT')?.iata).toBe('CLT');
    expect(findAirport('CLT')?.icao).toBe('KCLT');
    expect(findAirport('clt')?.icao).toBe('KCLT');
    expect(findAirport('  DCA ')?.icao).toBe('KDCA');
  });

  it('returns null for unknown codes instead of a nearest guess', () => {
    expect(findAirport('ZZZZ')).toBeNull();
    expect(findAirport('')).toBeNull();
    expect(findAirport(null)).toBeNull();
    expect(findAirport(undefined)).toBeNull();
  });

  it('searches by code, city and name', () => {
    expect(searchAirports('CLT')[0].icao).toBe('KCLT');
    expect(searchAirports('Charlotte')[0].icao).toBe('KCLT');
    expect(searchAirports('Douglas')[0].icao).toBe('KCLT');
    expect(searchAirports('zzzzzz')).toHaveLength(0);
  });

  it('reports the longest runway', () => {
    expect(longestRunwayFt(findAirport('KCLT')!)).toBe(10000);
  });
});

describe('aircraft dataset', () => {
  it('has unique ids', () => {
    expect(new Set(AIRCRAFT.map((a) => a.id)).size).toBe(AIRCRAFT.length);
  });

  it('is internally consistent on weights', () => {
    for (const a of AIRCRAFT) {
      if (a.weights.mlwLb) expect(a.weights.mlwLb, a.id).toBeLessThanOrEqual(a.weights.mtowLb);
      if (a.weights.oewLb) expect(a.weights.oewLb, a.id).toBeLessThan(a.weights.mtowLb);
      expect(a.weights.fuelCapacityLb, a.id).toBeLessThan(a.weights.mtowLb);
    }
  });

  it('has plausible performance figures', () => {
    for (const a of AIRCRAFT) {
      expect(a.performance.ceilingFt, a.id).toBeGreaterThan(20000);
      expect(a.performance.ceilingFt, a.id).toBeLessThan(55000);
      expect(a.performance.rangeNm, a.id).toBeGreaterThan(500);
      if (a.performance.mmo && a.performance.cruiseMach) {
        expect(a.performance.cruiseMach, a.id).toBeLessThanOrEqual(a.performance.mmo);
      }
    }
  });

  it('carries engineering notes, history and a source for every type', () => {
    for (const a of AIRCRAFT) {
      expect(a.engineering.length, a.id).toBeGreaterThan(0);
      expect(a.history.length, a.id).toBeGreaterThan(0);
      expect(a.sources.length, a.id).toBeGreaterThan(0);
      for (const s of a.sources) expect(s.url, `${a.id} ${s.name}`).toMatch(/^https:\/\//);
    }
  });

  it('includes the types the pilot actually flies', () => {
    expect(findAircraft('crj700')?.icaoType).toBe('CRJ7');
    expect(findAircraft('crj900')?.icaoType).toBe('CRJ9');
    expect(findAircraft('nope')).toBeNull();
  });
});

describe('layover guides', () => {
  it('has unique keys and place ids across every guide', () => {
    expect(new Set(LAYOVER_GUIDES.map((g) => g.key)).size).toBe(LAYOVER_GUIDES.length);
    const ids = LAYOVER_GUIDES.flatMap((g) => g.places.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every guide at airports CREW actually knows', () => {
    for (const g of LAYOVER_GUIDES) {
      for (const code of g.airports) {
        expect(findAirport(code), `${g.key} -> ${code}`).not.toBeNull();
      }
    }
  });

  it('gives every single place at least one link the pilot can verify', () => {
    for (const g of LAYOVER_GUIDES) {
      for (const p of g.places) {
        expect(p.links.length, p.id).toBeGreaterThan(0);
        for (const l of p.links) expect(l.url, `${p.id} ${l.name}`).toMatch(/^https:\/\//);
      }
    }
  });

  it('gives every place a reason to go and a realistic dwell time', () => {
    for (const g of LAYOVER_GUIDES) {
      for (const p of g.places) {
        expect(p.why.length, p.id).toBeGreaterThan(20);
        expect(p.dwellMinutes, p.id).toBeGreaterThan(0);
        expect(p.dwellMinutes, p.id).toBeLessThanOrEqual(360);
      }
    }
  });

  it('never claims a MICHELIN status without linking to the guide', () => {
    for (const g of LAYOVER_GUIDES) {
      for (const p of g.places) {
        if (!p.michelin) continue;
        expect(p.michelin.asOf, p.id).toBeTruthy();
        expect(
          p.links.some((l) => l.url?.includes('guide.michelin.com')),
          `${p.id} claims MICHELIN status but links nowhere to verify it`,
        ).toBe(true);
      }
    }
  });

  it('states MICHELIN coverage honestly for every city, with a link', () => {
    for (const g of LAYOVER_GUIDES) {
      expect(g.michelinCoverage.note.length, g.key).toBeGreaterThan(30);
      expect(g.michelinCoverage.url, g.key).toMatch(/^https:\/\//);
      // A city CREW says is uncovered must not carry starred entries.
      if (!g.michelinCoverage.covered) {
        expect(g.places.filter((p) => p.michelin), g.key).toHaveLength(0);
      }
    }
  });

  it('resolves a guide from any of its airports', () => {
    expect(guideForAirport('KCLT')?.key).toBe('clt');
    expect(guideForAirport('DCA')?.key).toBe('dca');
    expect(guideForAirport('IAD')?.key).toBe('dca');
    expect(guideForAirport('KPHX')).toBeNull();
  });

  it('finds a place by id', () => {
    expect(findPlace('clt-sullenberger')?.guide.key).toBe('clt');
    expect(findPlace('nope')).toBeNull();
  });

  it('falls back to source links rather than inventing a guide', () => {
    const fb = fallbackLinks('KPHX');
    expect(fb.city).toBe('Phoenix, AZ');
    expect(fb.links.length).toBeGreaterThan(0);
    for (const l of fb.links) expect(l.url).toMatch(/^https:\/\//);
  });
});
