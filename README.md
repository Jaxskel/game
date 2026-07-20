# 🌍 Global Conflict Monitor

A mobile-first PWA giving the public a clear, **safety-gated** worldwide view of
conflicts, diplomacy, humanitarian developments, and official addresses — built
exclusively from attributed public reporting.

> **Demo mode.** The app currently runs on a clearly-labeled **fictional
> scenario** (invented countries, ministries, outlets, and events using ISO
> private-use country codes). This is deliberate: the product's own rule is
> *never fabricate current events*, so seeded fixtures must never imitate
> real-world news. Every live source integration is implemented behind an
> interface and documented as `BLOCKED` until credentials and licenses are
> confirmed — see [docs/HANDOFF.md](docs/HANDOFF.md).

## What's inside

- **Map** — MapLibre GL globe (offline basemap, no external tiles), incident
  clustering, category-coded markers readable without color, public uncertainty
  radii, time-range controls, aggregate heat layer, shareable URLs, a complete
  list-view equivalent, and a WebGL-free fallback.
- **Incident details** — bottom sheet (peek/half/full snap points, drag handle,
  keyboard control, focus management, Back-button integration) with separate
  sections for confirmed facts, attributed claims, disputed points, and
  unknowns; source-attributed casualty ranges; per-source excerpts and links;
  update/correction/retraction history.
- **Feed** — story-clustered news with independent-source counts, verification /
  maturity / dispute / lifecycle / confidence labels, explained "Most
  significant" sorting, and a persistent **Official Addresses** tab with
  upcoming / live / ended / cancelled / replay states, timestamped transcripts,
  and `.ics` reminders.
- **Briefings** — Sunrise / Sunset / regional briefs with claim-level source
  lineage, labeled AI-assisted authoring, text-to-speech, offline saving, and
  correction history.
- **Watchlist** — follow countries, regions, conflicts, and address channels
  without an account; notification preferences with quiet hours and full
  opt-out (delivery requires the production push service).
- **Editorial safety pipeline** — independent-source counting that excludes
  syndication/aggregators/parties, explainable confidence, a 60-minute-minimum
  kinetic embargo, a server-side risk gate that can withhold indefinitely, and
  coordinate generalization. Public payloads are built from an explicit
  field allowlist (`PublicIncidentProjection`) — enforced by tests.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000 — no credentials needed
```

## Verification

```bash
npm run verify     # lint + typecheck + unit tests + production build
npm run test:e2e   # Playwright (mobile + desktop profiles)
```

In the hosted dev container, point Playwright at the preinstalled browser:
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — current implementation and the
  reference production architecture it is designed to grow into.
- [docs/SAFETY.md](docs/SAFETY.md) — the product boundary and how each rule is
  enforced in code.
- [docs/HANDOFF.md](docs/HANDOFF.md) — engineering handoff: verification
  statuses (`verified locally` vs `BLOCKED`), and exact steps to take each
  blocked integration live.

## Key directories

```
app/                 Routes (5 destinations + detail routes + /api/v1)
components/          UI (map, sheet, feed, addresses, briefings, …)
lib/domain/          Types, fixtures, pipeline (dedupe → confidence →
                     safety gate → projection), in-memory store
lib/sources/         Source-adapter interfaces (fixture adapter active;
                     live adapters implemented as explicit BLOCKED stubs)
public/data/         Offline Natural Earth 110m basemap (public domain)
tests/unit           Safety-invariant, pipeline, and query tests
tests/e2e            Playwright flows incl. HTTP safety checks
```
