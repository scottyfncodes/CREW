# CREW

A personal pilot operating system, built for one commercial pilot flying the
CRJ at PSA Airlines. Not a calculator collection, not an EFB clone, not a
travel app — one coherent app that answers *what does pilot-me want to know
or do right now?*

**Live: https://scottyfncodes.github.io/CREW/**

Add it to the iPhone home screen and it runs standalone, offline-capable,
dark by default.

## What is not

CREW is **not** an approved flight planning system, EFB, dispatch system,
aircraft manual, company manual, or ATC source, and nothing in it is an
operational clearance or instruction. Reference and calculated data is
labelled as such throughout, and every screen that shows operationally
significant information links to the official source. Nothing in the app is
ever fabricated: a value the source did not provide renders as unknown.

## The five worlds

| World | What it is |
| --- | --- |
| **Today** | The contextual home. Reads the trip, the clock and where you are, and shows what matters now — leave-home time, next leg, airborne progress, the layover, tomorrow's report. |
| **Flight Deck** | Aircraft profiles and comparison, airport briefs with live METAR/TAF, and eight aviation calculators. |
| **Layover** | Time-aware city guides. "I have five hours" produces a realistic plan, not fifty restaurants. |
| **Off Duty** | Pay and per diem against your own assumptions, expenses, logbook totals. |
| **Play** | Aircraft, airport, distance and engine games, plus your fleet, airports, cities and flights. |

## Architecture

The point of the design is that these are not five apps. One context model
feeds all of them.

```
src/
  core/          Pure domain logic. No React, no network, fully tested.
    types.ts       Pilot, Trip, DutyDay, Leg, Airport, AircraftSpec, Place...
    time/          Timezone-correct instants, durations, wall-clock rendering
    calc/          Atmosphere, wind, navigation, unit conversion
    parse/         Pasted-schedule parser ("Make Sense Of This")
    context/       The context engine, trip derivations, layover, pay, stats
  data/          Curated reference datasets, each entry carrying its sources
  services/      The only code that touches the network, with caching,
                 staleness flags and graceful failure
  store/         One state tree, localStorage-backed, no state library
  features/      Screens. Presentation only — they read core and services
  ui/            Shared primitives
```

Rules the codebase holds to:

- **Business logic never lives in a component.** Components read `core/`.
- **External APIs never appear in a component.** They live behind adapters in
  `services/`, which return an envelope carrying the source, fetch time and a
  stale flag.
- **Unknown stays unknown.** `null` is rendered as unknown, never as zero or a
  guess. The schedule parser reports every line it did not understand and
  every assumption it had to make.
- **Everything external carries a link back to its source.**

### Context engine

`core/context/engine.ts` answers one question — what is the pilot doing right
now — and returns a `PilotContext` plus an ordered list of home cards. The
home screen renders that list; it does not decide it. States are `no-trip`,
`pre-trip`, `leave-soon`, `on-duty`, `layover` and `trip-complete`.

### Data provenance

`data/` holds curated airports, aircraft and layover guides. Every airport
links to AirNav and the FAA Chart Supplement. Every aircraft links to
manufacturer data. Every place in a layover guide links somewhere you can
verify it exists and is open. A MICHELIN status is never claimed without a
link to the guide, and a city CREW says is not covered by MICHELIN cannot
carry a starred entry — `src/data/data.test.ts` enforces both.

## Development

```bash
npm install
npm run dev      # vite dev server
npm test         # vitest, logic only — no DOM tests for their own sake
npm run build    # tsc -b, vite build, then generate the service worker
npm run verify   # test + build
```

`scripts/gen-airports.py` regenerates `src/data/airports.ts` from a compact
table — edit the table, not the generated file.

`scripts/gen-sw.mjs` runs after every build and precaches the built shell so
the app cold-launches offline. External data is never precached; the fetch
layer handles that so stale readings always carry their own timestamp.

## Deployment

Pushing to the default branch builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The app uses hash routing because Pages has
no rewrite rules — a deep link needs to survive a refresh and a home-screen
launch.
