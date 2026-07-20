import type { Confidence, ConfidenceBand } from "./types";

export const CONFIDENCE_VERSION = "2026.07-1";

export interface ConfidenceInputs {
  independentSourceCount: number;
  hasPrimaryEvidence: boolean;
  officialClaimPresent: boolean;
  contradictionCount: number;
  geographicClarity: "clear" | "approximate" | "vague";
  editorReviewed: boolean;
}

/**
 * Confidence means confidence in the available reporting — not metaphysical
 * certainty. The numeric score stays internal; only the band plus a
 * plain-language rationale is ever shown.
 */
export function computeConfidence(inputs: ConfidenceInputs): Confidence & {
  scoreInternal: number;
} {
  let score = 0;
  const reasons: string[] = [];

  if (inputs.independentSourceCount >= 3) {
    score += 40;
    reasons.push(
      `${inputs.independentSourceCount} independent sources report consistent details`,
    );
  } else if (inputs.independentSourceCount === 2) {
    score += 30;
    reasons.push("two independent sources corroborate the core claim");
  } else if (inputs.independentSourceCount === 1) {
    score += 15;
    reasons.push("only a single independent source so far");
  } else {
    reasons.push("no independent sourcing yet");
  }

  if (inputs.hasPrimaryEvidence) {
    score += 20;
    reasons.push("primary evidence is cited in reporting");
  }
  if (inputs.officialClaimPresent) {
    score += 10;
    reasons.push(
      "an official statement exists (a primary claim, not independent confirmation)",
    );
  }
  if (inputs.contradictionCount > 0) {
    score -= 15 * inputs.contradictionCount;
    reasons.push(
      `${inputs.contradictionCount} contradictory report${inputs.contradictionCount > 1 ? "s" : ""} remain unresolved`,
    );
  }
  if (inputs.geographicClarity === "clear") score += 10;
  else if (inputs.geographicClarity === "vague") {
    score -= 10;
    reasons.push("the reported location remains vague");
  }
  if (inputs.editorReviewed) {
    score += 20;
    reasons.push("reviewed by an editor");
  }

  const band: ConfidenceBand = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";

  return {
    band,
    rationale: `${capitalize(band)} confidence: ${reasons.join("; ")}.`,
    version: CONFIDENCE_VERSION,
    scoreInternal: score,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
