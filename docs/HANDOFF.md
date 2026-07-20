# Engineering handoff

## Verification status

Legend: ✅ `verified locally` · 🔶 `BLOCKED` (externally blocked — interface +
fixtures implemented; exact unblocking steps below) · ⬜ not started.

### Product surfaces

| Item | Status |
| --- | --- |
| Map globe (offline basemap, clustering, category markers, uncertainty radii, heat layer, time controls, shareable URLs, list equivalent, WebGL fallback, reduced motion) | ✅ 26 e2e + screenshots at 375/820/1440 px, dark+light |
| Incident sheet (snap points, drag, keyboard, focus, Back integration, prev/next navigation between visible incidents, evidence sections, sources w/ excerpts, corrections/retractions, save/share/report) | ✅ |
| Standalone incident route `/incident/[id]` | ✅ |
| Feed: story clusters, labels, independent-source counts, significance sort with visible factors, tab state preserved across navigation | ✅ |
| Official addresses hub: upcoming/live/ended/cancelled/replay states, transcripts, `.ics` reminder, follow channel, post-follow notification prompt | ✅ |
| Briefings: sunrise/sunset/regional, claim-level lineage, labeled AI-assist, TTS, offline save, corrections | ✅ |
| Watchlist + notification preferences (quiet hours, mute, opt-out) | ✅ preferences; 🔶 delivery (needs push service + APNs/FCM keys) |
| Onboarding (3 skippable screens), settings, source transparency, clear-local-data | ✅ |
| PWA: manifest, icons, install, scoped service worker, offline briefings | ✅ locally (Lighthouse-style manual pass; run a real Lighthouse audit post-deploy) |
| API v1 with zod validation, cursor pagination, stable errors | ✅ |
| Safety gates (embargo, kinetic floor, risk withhold, projection allowlist, coordinate rounding) | ✅ unit + e2e |

### Integrations (all behind `lib/sources/adapters.ts`)

| Adapter | Status | To take live |
| --- | --- | --- |
| Fixtures (fictional scenario) | ✅ | — |
| GDELT (discovery only) | 🔶 | Approve `api.gdeltproject.org` egress; define query scope; then implement `fetchSince` against the DOC 2.0 API; verify with recorded-cassette tests before enabling. |
| ACLED | 🔶 | Obtain license confirming this use; set `ACLED_API_KEY`/`ACLED_EMAIL`; implement fetch; respect rate limits. |
| ReliefWeb/OCHA | 🔶 | Approve `api.reliefweb.int` egress; attribution per terms. |
| YouTube Data API (official channels) | 🔶 | `YOUTUBE_API_KEY` + editor-approved channel allowlist; embeds only where permitted. |
| GDACS (disaster context only) | 🔶 | Approve egress; label separately from conflict reporting (fixture flood incident shows the intended labeling). |
| Push notifications | 🔶 | Deploy push service; request permission flow already gated on follow. |
| PostgreSQL/Redis/queue/S3 | 🔶 | Reference deployment (see ARCHITECTURE); replace `lib/domain/store.ts` internals behind its existing query interface. |

> Fixtures are never proof of a production integration. Each live adapter
> needs: recorded fixtures for CI, a cassette-replay test, a rate-limit budget,
> license notes in the source registry, and editorial approval before enabling.

### Not yet built (next phases)

- Editorial/admin console (review queue, merge/split, precision reduction,
  embargo extension, kill switches, audit trail) — data model and gate
  semantics already exist server-side.
- Accounts/OIDC (public reading intentionally works without them).
- SSE for delayed published-news updates.
- Search upgrade path (PG FTS → OpenSearch) — current in-memory search sits
  behind `search()` in the store for exactly this swap.
- i18n beyond English; media assets with blur/content warnings.
- CI pipeline: run `npm run verify` + `npm run test:e2e` on push (workflow file
  intentionally omitted until the repo's CI provider is chosen).

## Known limitations

- Demo timestamps are relative to server start (store rebuilds every 5 min), so
  the embargoed fixture stays perpetually ~30 min from publication — that is
  the demonstration of withholding, not a bug.
- Cluster counts/markers are HTML elements; at extreme densities (thousands of
  points) migrate counts to symbol layers with self-hosted glyphs.
- `npm audit` (2026-07-20): 2 moderate advisories, both the PostCSS
  `</style>` stringify issue in the copy **vendored inside next@15.5.20**
  (build-time CSS generation; no attacker-controlled CSS in this app). The
  suggested "fix" downgrades Next to 9.x — do not apply; instead bump Next
  when a patched 15.x lands and re-run the audit before release.

## How to verify everything

```bash
npm run verify                                            # lint+types+unit+build
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npm run test:e2e                                        # 26 e2e, mobile+desktop
node scripts/gen-icons.mjs                                # regenerate PWA icons
node scripts/prepare-countries.mjs <ne110.geojson> \
  public/data/countries.json                              # regenerate basemap
```
