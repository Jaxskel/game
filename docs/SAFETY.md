# Safety model

This is a public-interest news and situational-awareness product. It is not a
battlefield command system, targeting tool, surveillance product, weapons aid,
or live military intelligence service. That boundary is enforced in code, not
just policy:

| Rule | Enforcement |
| --- | --- |
| Publish kinetic incidents only after an approved source reported them **and** a safety delay elapsed (≥60 min) | `gateIncident()` in `lib/domain/safety.ts`: embargo timestamp **and** a hard kinetic floor computed from `firstReportedAt`. Unit-tested. |
| Embargo expiry is necessary but never sufficient | `riskWithheld` flag survives any embargo expiry; the gate returns unpublishable indefinitely. Unit-tested (`inc-risk-withheld`). |
| Generalize active-event locations; no hidden precise coordinates anywhere public | Incidents store only coarse geometry with named precision + uncertainty radius; `generalizeLocation()` rounds to 1 decimal (~11 km) and enforces ≥10 km uncertainty for kinetic categories; e2e asserts this over HTTP for every payload. |
| Public payloads can never leak internal fields | `PublicIncidentProjection` is an explicit allowlist; the projector copies field-by-field. Withheld incidents never enter the store, so search/API/map/share simply cannot see them. |
| A report naming only a province must never appear as a pinpoint | Location precision is a first-class field (`country/admin-region/district/city/coarse-cell`) with a user-visible explanation; markers derive only from the generalized point + radius. |
| No live movement paths or movement inference | No trajectory/route data model exists; the time slider filters discrete events; the heat layer aggregates **delayed incident counts** only and says so in the UI. |
| Official claims are claims, not confirmations | `Provenance` is a separate axis rendered as “Claimed by [named source]”; conflict-party official sources have `countsAsEvidence: false` so they can never inflate the independent-source count. Unit-tested. |
| Aggregators (GDELT-analog) are discovery, not evidence | `countsAsEvidence: false` + excluded from public source lists. Unit-tested. |
| Never fabricate events, streams, quotes, schedules, or transcripts | Demo data is a **fictional scenario** with a persistent banner; no fake embeds — address pages link to the (demo) official source and say why no player is shown. |
| Retractions stay visible | `lifecycle: retracted` renders a prominent retraction notice with the correction record; the incident is not deleted. |
| Confidence is explainable, never a mystery score | Numeric score is internal-only and versioned; the public sees Low/Moderate/High + a plain-language rationale generated from the actual inputs. |
| No account required to read; no location permission; no tracking | Follows/preferences are localStorage-only; `Permissions-Policy` denies geolocation; no analytics. |
| Notification restraint | Defaults to high-significance corroborated updates; quiet hours; per-topic mute; complete opt-out; hyperlocal tactical alerts have no code path. |
| Content warnings | `sensitiveContent` flag modeled; graphic-media blurring applies when media support lands (no media in demo fixtures). |

## What live ingestion must add (unchanged rules)

The pipeline stages in docs/ARCHITECTURE.md inherit these obligations: SSRF-safe
allowlisted fetching, hostile-input parsing in sandboxes, license-bounded
storage with deletion/takedown workflows, prompt-injection isolation for any AI
extraction, fail-closed behavior on insufficient evidence, and human review
before publishing casualty totals, atrocity allegations, first-time sources,
disputed media, or high-impact notifications.
