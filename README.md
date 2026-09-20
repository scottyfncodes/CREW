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

## The loop

CREW is organised around one loop, not a grid of features:

**Schedule → Today → Flight/Layover → Logbook**

A pilot builds a trip in Schedule — a flight number and a date at a time, or
a whole pairing pasted in one go. Today is generated from whatever trip is
current or next: report time, the leg in progress, the layover, tomorrow.
Landing a flight surfaces it for a one-tap review into the Logbook, which is
also where personal flying history — fleet, airports, cities — lives.

| Tab | What it is |
| --- | --- |
| **Today** | The contextual home. Reads the trip, the clock and where you are, and shows what matters now — leave-home time, next leg, airborne progress, the layover, a flight ready to log, tomorrow's report. |
| **Schedule** | Add a flight by number and date — CREW looks up the route, times and aircraft and asks you to confirm. Flights on nearby dates fold into the same trip automatically. Current / upcoming / past trips, each editable. |
| **Logbook** | What actually happened. A landed flight waits here for a one-tap review before it becomes a permanent record. Also fleet, airports, cities and every flight you've flown. |
| **Tools** | Everything else that still earns a place: aircraft and airport reference, eight aviation calculators, pay and expenses, layover guides, trivia games, settings. |

Layover exploration and individual flight/aircraft/airport detail are reached
contextually — from a Today card, a Schedule trip, or Tools' reference
section — rather than living as their own top-level tabs.

## Architecture

The point of the design is that these are not separate apps. One `Trip` model
— `Trip → DutyDay → Leg` — feeds Schedule, Today, Layover, pay and the
Logbook alike; a `Leg` is canonical, never re-typed into a parallel shape.

```
src/
  core/          Pure domain logic. No React, no network, fully tested.
    types.ts       Pilot, Trip, DutyDay, Leg, FlightRecord, Airport, Place...
    time/          Timezone-correct instants, durations, wall-clock rendering
    calc/          Atmosphere, wind, navigation, unit conversion
    parse/         Pasted-pairing parser (paste-a-whole-trip path)
    context/
      engine.ts      What is the pilot doing right now, and which Today
                      cards follow from it
      schedule.ts    Trip phase (current/upcoming/past), folding a new
                      flight into the right trip and day, and which landed
                      legs are ready to become logbook entries
      trip.ts        Derivations off a single Trip: duty time, layovers,
                      route lines, leave-home time
      layover.ts, pay.ts, stats.ts
  data/          Curated reference datasets, each entry carrying its sources
  services/
    flightLookup.ts  Flight-number + date -> a fillable flight. Checks the
                      pilot's own trip history first (free, instant), then
                      live ADS-B, then AeroDataBox if a key is set — merges
                      what comes back and labels every field's source
    weather.ts, fetcher.ts
  store/         One state tree, localStorage-backed, no state library
  features/
    schedule/      Add a flight, browse current/upcoming/past trips, edit
                    a trip's legs
    logbook/       Fleet/airports/cities/flights, and reviewing a landed
                    leg into a permanent record
    home/          Today
    tools/, flightdeck/, aircraft/, airport/, layover/, offduty/, play/,
    settings/, makesense/   Reference material and the paste-a-pairing path
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
`pre-trip`, `leave-soon`, `on-duty`, `layover` and `trip-complete`. The trip it
builds from is whichever one `core/context/schedule.ts` decides is current
right now, or failing that the soonest upcoming one — a pilot never has to
tell CREW which trip is "active."

A landed leg not yet in the logbook (`unloggedLegs`, cross-referenced by
`FlightRecord.sourceLegId`) always earns a "ready to log" card, wherever it
happened in the trip — not just on whatever day the context currently reads
as "today."

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
