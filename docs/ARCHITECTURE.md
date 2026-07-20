# Architecture

## Current implementation (demo/fixture mode)

A Next.js 15 (App Router) TypeScript application. Pinned dependencies; no
credentials required; every external integration behind an interface.

```
fixtures (fictional scenario, relative timestamps)
   │
   ▼
lib/domain pipeline  ──  countIndependentSources()   dedupe.ts
                     ──  verification derivation      store.ts
                     ──  computeConfidence()          confidence.ts   (score internal, band+rationale public)
                     ──  gateIncident()               safety.ts       (embargo + kinetic floor + risk gate)
                     ──  projectIncident()            projection.ts   (explicit field allowlist)
   │
   ▼
in-memory Store (public projections ONLY — withheld incidents never enter it)
   │
   ├── /api/v1/* route handlers (zod-validated, cursor pagination, stable errors)
   └── server components (briefings, addresses, incident route)
   │
   ▼
client UI (map globe, feed, sheets) — fetches only /api/v1 payloads
```

Design invariants:

1. **Nothing public exists outside `PublicIncidentProjection`.** The store holds
   projections, not internal records; the projector copies field-by-field from
   an allowlist and never spreads. Tests assert the allowlist, coordinate
   rounding (≤1 decimal ≈ 11 km), and the absence of internal fields over HTTP.
2. **Withheld = nonexistent.** Embargoed/risk-withheld incidents are excluded
   at store build; API 404s are indistinguishable from missing IDs.
3. **Aggregators are discovery, not evidence.** They never appear in public
   source lists and never count toward independence.
4. **The map has no external dependency.** Basemap = bundled Natural Earth
   110m GeoJSON (public domain, stripped to name+geometry); markers/clusters are
   HTML elements (no glyph/sprite servers); CSP allows only self + the optional
   demotiles host.

## Frontend notes

- Mobile-first: bottom navigation with safe-area padding (`--nav-h`,
  `env(safe-area-inset-*)`); ≥44 px touch targets (`.tap`); desktop navigation
  rail from `md:`.
- Incident sheet: deterministic snap points (peek/half/full), pointer-drag +
  keyboard (arrow keys/Escape), `history.pushState` integration so Back closes
  the sheet, focus moves to the sheet heading on open, background gets `inert`
  when fully expanded.
- Theme: CSS custom properties; `data-theme` attribute set pre-paint from
  localStorage; `prefers-color-scheme` respected in "system".
- Reduced motion: global CSS kill-switch plus `jumpTo` instead of
  `flyTo/easeTo` for programmatic camera moves.
- PWA: manifest + generated icons; service worker caches static assets and
  user-saved briefings only — **API responses are never cached** so safety-gate
  changes always win.

## Reference production architecture (designed for, not yet deployed)

Single reference deployment target: **one region of a managed container
platform (e.g. Fly.io/Render/ECS) + managed PostgreSQL**. Provider interfaces
keep this portable.

- Modular monolith (this app) + separate ingestion/queue workers.
- PostgreSQL + PostGIS as source of truth; the `lib/domain/store.ts` query
  interface is the seam where SQL replaces fixtures.
- Redis for cache/rate limits; BullMQ for the replayable ingestion pipeline
  (idempotent jobs, backoff, DLQs, per-source circuit breakers).
- S3-compatible storage for retention-bounded permitted source records.
- SSE for delayed published-news updates.
- OIDC + MFA + RBAC for the editorial console (viewer/editor/senior
  editor/source manager/admin).
- The full required data model (Source, SourceFeed, SourceDocument, Article,
  Claim, Incident, IncidentRevision, …, SafetyEmbargo, IngestionJob, AuditLog)
  is typed in `lib/domain/types.ts` where exercised today; the remainder is
  specified in docs/HANDOFF.md as the migration plan.

## Dependency decisions (pinned)

| Dependency | Version | Why |
| --- | --- | --- |
| next | 15.5.20 | Current stable App Router; route handlers; static/dynamic control |
| react | 19.1.0 | Current stable |
| maplibre-gl | 5.6.1 | Globe projection landed in v5; open-source; no token |
| zod | 4.4.3 | Runtime validation for every API query |
| tailwindcss | 4.1.11 | Utility CSS with a tokens-first design system |
| vitest | 4.1.10 | Fast unit tests |
| @playwright/test | 1.61.1 | Mobile+desktop e2e including HTTP safety checks |
