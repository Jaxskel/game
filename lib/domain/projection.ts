import { gateIncident, generalizeLocation } from "./safety";
import {
  KINETIC_CATEGORIES,
  type AttributedEstimate,
  type Confidence,
  type CorrectionRecord,
  type DisputeState,
  type Incident,
  type IncidentCategory,
  type IncidentUpdate,
  type Lifecycle,
  type Maturity,
  type Provenance,
  type PublicLocation,
  type Verification,
} from "./types";

/**
 * The ONLY incident shape that may reach a client, search index, cache, map
 * tile, notification, share card, or export. Built as an explicit allowlist —
 * internal fields can never leak by omission.
 */
export interface PublicIncidentProjection {
  id: string;
  headline: string;
  summary: string;
  category: IncidentCategory;
  conflictId?: string;
  tags: string[];
  eventTime: string;
  eventTimePrecision: Incident["eventTimePrecision"];
  eventTimezone: string;
  firstReportedAt: string;
  publishedAt: string;
  updatedAt: string;
  verification: Verification;
  maturity: Maturity;
  provenance: Provenance;
  dispute: DisputeState;
  lifecycle: Lifecycle;
  confidence: Confidence;
  location: PublicLocation;
  confirmedFacts: string[];
  attributedClaims: string[];
  disputedPoints: string[];
  unknowns: string[];
  casualtyEstimates: AttributedEstimate[];
  sources: PublicIncidentSource[];
  independentSourceCount: number;
  relatedIncidentIds: string[];
  briefingId?: string;
  updatesLog: IncidentUpdate[];
  corrections: CorrectionRecord[];
  sensitiveContent: boolean;
  demo: boolean;
}

export interface PublicIncidentSource {
  publisher: string;
  sourceType: string;
  url: string;
  publishedAt: string;
  supportsClaim: string;
  excerpt: string;
}

/** Field allowlist used both by the projector and by tests. */
export const PUBLIC_INCIDENT_FIELDS = [
  "id",
  "headline",
  "summary",
  "category",
  "conflictId",
  "tags",
  "eventTime",
  "eventTimePrecision",
  "eventTimezone",
  "firstReportedAt",
  "publishedAt",
  "updatedAt",
  "verification",
  "maturity",
  "provenance",
  "dispute",
  "lifecycle",
  "confidence",
  "location",
  "confirmedFacts",
  "attributedClaims",
  "disputedPoints",
  "unknowns",
  "casualtyEstimates",
  "sources",
  "independentSourceCount",
  "relatedIncidentIds",
  "briefingId",
  "updatesLog",
  "corrections",
  "sensitiveContent",
  "demo",
] as const;

/**
 * Project an internal incident to its public shape, or null when the safety
 * gate withholds it. Copies field-by-field from the allowlist semantics —
 * never spreads the internal object.
 */
export function projectIncident(
  incident: Incident,
  sources: PublicIncidentSource[],
  now: Date,
): PublicIncidentProjection | null {
  const gate = gateIncident(incident, now);
  if (!gate.publishable) return null;

  const isKinetic = KINETIC_CATEGORIES.has(incident.category);

  return {
    id: incident.id,
    headline: incident.headline,
    summary: incident.summary,
    category: incident.category,
    conflictId: incident.conflictId,
    tags: [...incident.tags],
    eventTime: incident.eventTime,
    eventTimePrecision: incident.eventTimePrecision,
    eventTimezone: incident.eventTimezone,
    firstReportedAt: incident.firstReportedAt,
    publishedAt: incident.publishedAt,
    updatedAt: incident.updatedAt,
    verification: incident.verification,
    maturity: incident.maturity,
    provenance: { ...incident.provenance },
    dispute: incident.dispute,
    lifecycle: incident.lifecycle,
    confidence: {
      band: incident.confidence.band,
      rationale: incident.confidence.rationale,
      version: incident.confidence.version,
    },
    location: generalizeLocation(incident.location, isKinetic),
    confirmedFacts: [...incident.confirmedFacts],
    attributedClaims: [...incident.attributedClaims],
    disputedPoints: [...incident.disputedPoints],
    unknowns: [...incident.unknowns],
    casualtyEstimates: incident.casualtyEstimates.map((e) => ({ ...e })),
    sources,
    independentSourceCount: incident.independentSourceCount,
    relatedIncidentIds: [...incident.relatedIncidentIds],
    briefingId: incident.briefingId,
    updatesLog: incident.updatesLog.map((u) => ({ ...u })),
    corrections: incident.corrections.map((c) => ({ ...c })),
    sensitiveContent: incident.sensitiveContent,
    demo: incident.demo,
  };
}
