import { describe, expect, it } from "vitest";
import { buildStore, queryIncidents, queryNews, search } from "@/lib/domain/store";

const NOW = new Date("2026-07-20T12:00:00Z");

describe("store pipeline", () => {
  const store = buildStore(NOW);

  it("excludes embargoed and risk-withheld incidents from the public store entirely", () => {
    expect(store.incidentsById.has("inc-kessel-east-embargoed")).toBe(false);
    expect(store.incidentsById.has("inc-risk-withheld")).toBe(false);
  });

  it("derives verification from independent-source count", () => {
    expect(store.incidentsById.get("inc-kessel-strike")?.verification).toBe("corroborated");
    expect(store.incidentsById.get("inc-drone-havren")?.verification).toBe("single-source");
    expect(store.incidentsById.get("inc-kessel-strike")?.independentSourceCount).toBe(2);
  });

  it("keeps retracted incidents visible with their correction record", () => {
    const retracted = store.incidentsById.get("inc-nerath-bridge-retracted");
    expect(retracted?.lifecycle).toBe("retracted");
    expect(retracted?.corrections.length).toBeGreaterThan(0);
  });

  it("never lists aggregator records among an incident's public sources", () => {
    for (const incident of store.incidents) {
      for (const source of incident.sources) {
        expect(source.sourceType).not.toBe("aggregator");
      }
    }
  });

  it("official claims are labeled as claims, never as confirmation", () => {
    const kessel = store.incidentsById.get("inc-kessel-strike");
    expect(kessel?.provenance.officialClaimPresent).toBe(true);
    expect(kessel?.provenance.officialClaimSource).toBe("Ardenia Ministry of Defense");
    // The official statement does not inflate independent corroboration.
    expect(kessel?.independentSourceCount).toBe(2);
  });
});

describe("queries", () => {
  const store = buildStore(NOW);

  it("filters by category and time range", () => {
    const strikes = queryIncidents(store, { category: "air-missile-strike" });
    expect(strikes.items.length).toBeGreaterThan(0);
    for (const i of strikes.items) expect(i.category).toBe("air-missile-strike");

    const recent = queryIncidents(store, { sinceHours: 24 });
    for (const i of recent.items) {
      expect(new Date(i.eventTime).getTime()).toBeGreaterThanOrEqual(
        NOW.getTime() - 24 * 3_600_000,
      );
    }
    // 30-day range includes the archived incident; 24h does not.
    const month = queryIncidents(store, { sinceHours: 24 * 30 });
    expect(month.items.some((i) => i.id === "inc-kessel-depot-archived")).toBe(true);
    expect(recent.items.some((i) => i.id === "inc-kessel-depot-archived")).toBe(false);
  });

  it("paginates with a stable cursor", () => {
    const page1 = queryIncidents(store, { limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBe(3);
    const page2 = queryIncidents(store, { limit: 3, cursor: page1.nextCursor! });
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it("news tabs filter as documented", () => {
    for (const c of queryNews(store, { tab: "breaking" }).items) {
      expect(c.badge).toBe("breaking");
    }
    for (const c of queryNews(store, { tab: "humanitarian" }).items) {
      expect(c.category).toBe("humanitarian");
    }
  });

  it("news significance sort explains its factors", () => {
    const sorted = queryNews(store, { sort: "significance" }).items;
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].significance).toBeGreaterThanOrEqual(sorted[i].significance);
    }
    for (const c of sorted) expect(c.significanceFactors.length).toBeGreaterThan(0);
  });

  it("search groups results and never surfaces withheld incidents", () => {
    const results = search(store, "Kessel");
    expect(results.incidents.length).toBeGreaterThan(0);
    expect(results.incidents.some((i) => i.id === "inc-kessel-east-embargoed")).toBe(false);
    const empty = search(store, "evacuation corridor");
    expect(empty.incidents).toHaveLength(0);
  });
});
