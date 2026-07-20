import { describe, expect, it } from "vitest";
import { PUBLIC_INCIDENT_FIELDS } from "@/lib/domain/projection";
import { buildStore } from "@/lib/domain/store";

const NOW = new Date("2026-07-20T12:00:00Z");

describe("PublicIncidentProjection", () => {
  const store = buildStore(NOW);

  it("only contains allowlisted fields — internal fields can never leak", () => {
    const allowed = new Set<string>(PUBLIC_INCIDENT_FIELDS);
    for (const incident of store.incidents) {
      for (const key of Object.keys(incident)) {
        expect(allowed.has(key), `unexpected public field: ${key}`).toBe(true);
      }
      expect(incident).not.toHaveProperty("internalNotes");
      expect(incident).not.toHaveProperty("confidenceScoreInternal");
      expect(incident).not.toHaveProperty("riskWithheld");
      expect(incident).not.toHaveProperty("embargo");
    }
  });

  it("never exposes coordinates with more than one decimal of precision", () => {
    for (const incident of store.incidents) {
      const { lat, lon } = incident.location;
      expect(lat).toBe(Math.round(lat * 10) / 10);
      expect(lon).toBe(Math.round(lon * 10) / 10);
    }
  });

  it("shows only Low/Moderate/High confidence with a plain-language rationale", () => {
    for (const incident of store.incidents) {
      expect(["low", "moderate", "high"]).toContain(incident.confidence.band);
      expect(incident.confidence.rationale.length).toBeGreaterThan(20);
      // No numeric score in the public confidence object.
      expect(Object.keys(incident.confidence).sort()).toEqual([
        "band",
        "rationale",
        "version",
      ]);
    }
  });

  it("keeps every kinetic incident at >=10 km public uncertainty", () => {
    for (const incident of store.incidents) {
      const kinetic = [
        "air-missile-strike",
        "drone-event",
        "ground-fighting",
        "naval-incident",
        "explosion",
        "interception",
      ].includes(incident.category);
      if (kinetic) {
        expect(incident.location.uncertaintyKm).toBeGreaterThanOrEqual(10);
      }
    }
  });
});
