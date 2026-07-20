import { describe, expect, it } from "vitest";
import { buildFixtures } from "@/lib/domain/fixtures";
import { gateIncident, generalizeLocation, roundCoord } from "@/lib/domain/safety";

const NOW = new Date("2026-07-20T12:00:00Z");

function fixtureIncident(id: string) {
  const incident = buildFixtures(NOW).incidents.find((i) => i.id === id);
  if (!incident) throw new Error(`missing fixture ${id}`);
  return incident;
}

describe("safety gate", () => {
  it("withholds an incident whose embargo has not elapsed", () => {
    const inc = fixtureIncident("inc-kessel-east-embargoed");
    expect(gateIncident(inc, NOW).publishable).toBe(false);
  });

  it("publishes the same incident once the embargo and kinetic delay elapse", () => {
    const inc = fixtureIncident("inc-kessel-east-embargoed");
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    expect(gateIncident(inc, later).publishable).toBe(true);
  });

  it("embargo expiry is never sufficient: risk-withheld incidents stay withheld", () => {
    const inc = fixtureIncident("inc-risk-withheld");
    // Its embargo elapsed hours ago...
    expect(new Date(inc.embargo.publishNotBefore) < NOW).toBe(true);
    // ...but the risk gate still withholds it, indefinitely.
    const decision = gateIncident(inc, NOW);
    expect(decision.publishable).toBe(false);
    const farFuture = new Date(NOW.getTime() + 365 * 24 * 3_600_000);
    expect(gateIncident(inc, farFuture).publishable).toBe(false);
  });

  it("enforces the 60-minute kinetic floor even if the stored embargo is shorter", () => {
    const inc = fixtureIncident("inc-kessel-strike");
    const justReported = {
      ...inc,
      firstReportedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
      embargo: { ...inc.embargo, publishNotBefore: NOW.toISOString() },
    };
    expect(gateIncident(justReported, NOW).publishable).toBe(false);
  });

  it("never publishes drafts", () => {
    const inc = { ...fixtureIncident("inc-kessel-strike"), lifecycle: "draft" as const };
    expect(gateIncident(inc, NOW).publishable).toBe(false);
  });
});

describe("location generalization", () => {
  it("rounds coordinates so markers cannot imply pinpoint accuracy", () => {
    expect(roundCoord(47.263559)).toBe(47.3);
    expect(roundCoord(-8.04211)).toBe(-8.0);
  });

  it("enforces a minimum uncertainty radius for kinetic incidents", () => {
    const loc = fixtureIncident("inc-kessel-strike").location;
    const generalized = generalizeLocation({ ...loc, uncertaintyKm: 1 }, true);
    expect(generalized.uncertaintyKm).toBeGreaterThanOrEqual(10);
  });

  it("keeps stated uncertainty for non-kinetic incidents", () => {
    const loc = fixtureIncident("inc-ceasefire-talks").location;
    const generalized = generalizeLocation(loc, false);
    expect(generalized.uncertaintyKm).toBe(loc.uncertaintyKm);
  });
});
