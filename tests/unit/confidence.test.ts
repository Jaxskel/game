import { describe, expect, it } from "vitest";
import { computeConfidence } from "@/lib/domain/confidence";

describe("computeConfidence", () => {
  it("gives high confidence to well-corroborated, reviewed reporting", () => {
    const c = computeConfidence({
      independentSourceCount: 3,
      hasPrimaryEvidence: true,
      officialClaimPresent: true,
      contradictionCount: 0,
      geographicClarity: "clear",
      editorReviewed: true,
    });
    expect(c.band).toBe("high");
    expect(c.rationale).toContain("independent sources");
  });

  it("gives low confidence to a lone vague report", () => {
    const c = computeConfidence({
      independentSourceCount: 1,
      hasPrimaryEvidence: false,
      officialClaimPresent: false,
      contradictionCount: 0,
      geographicClarity: "vague",
      editorReviewed: false,
    });
    expect(c.band).toBe("low");
  });

  it("contradictions lower the band and appear in the rationale", () => {
    const base = {
      independentSourceCount: 2,
      hasPrimaryEvidence: true,
      officialClaimPresent: false,
      geographicClarity: "clear" as const,
      editorReviewed: true,
    };
    const clean = computeConfidence({ ...base, contradictionCount: 0 });
    const contested = computeConfidence({ ...base, contradictionCount: 2 });
    expect(contested.scoreInternal).toBeLessThan(clean.scoreInternal);
    expect(contested.rationale).toContain("contradictory");
  });

  it("an official claim is framed as a claim, not confirmation", () => {
    const c = computeConfidence({
      independentSourceCount: 0,
      hasPrimaryEvidence: false,
      officialClaimPresent: true,
      contradictionCount: 0,
      geographicClarity: "approximate",
      editorReviewed: false,
    });
    expect(c.band).toBe("low");
    expect(c.rationale).toContain("not independent confirmation");
  });
});
