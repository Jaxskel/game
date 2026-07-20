/**
 * Core domain model.
 *
 * The internal record types in this file are NEVER serialized to a client.
 * Everything public flows through `PublicIncidentProjection` (projection.ts),
 * which is an explicit field allowlist. Keep that invariant: new internal
 * fields are private by default.
 */

// ---------------------------------------------------------------------------
// Independent editorial axes. These are deliberately separate — never collapse
// them into a single "truth score".
// ---------------------------------------------------------------------------

export type Verification = "unverified" | "single-source" | "corroborated";
export type Maturity = "developing" | "stable";
export type DisputeState = "undisputed" | "disputed";
export type Lifecycle =
  | "draft"
  | "published"
  | "corrected"
  | "retracted"
  | "archived";
export type ConfidenceBand = "low" | "moderate" | "high";

/** An official claim is provenance, not confirmation. */
export interface Provenance {
  officialClaimPresent: boolean;
  /** Named official source, e.g. "Ardenia Ministry of Defense". */
  officialClaimSource?: string;
}

export interface Confidence {
  band: ConfidenceBand;
  /** Plain-language explanation shown to users. */
  rationale: string;
  /** Versioned so scoring changes are auditable. */
  version: string;
}

// ---------------------------------------------------------------------------
// Incident categories (map marker taxonomy).
// ---------------------------------------------------------------------------

export const INCIDENT_CATEGORIES = [
  "air-missile-strike",
  "drone-event",
  "ground-fighting",
  "naval-incident",
  "explosion",
  "interception",
  "civil-unrest",
  "cyber-incident",
  "ceasefire-negotiation",
  "sanctions-diplomacy",
  "humanitarian-emergency",
  "official-address",
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/** Categories that describe kinetic events and get the strictest safety gate. */
export const KINETIC_CATEGORIES: ReadonlySet<IncidentCategory> = new Set([
  "air-missile-strike",
  "drone-event",
  "ground-fighting",
  "naval-incident",
  "explosion",
  "interception",
]);

// ---------------------------------------------------------------------------
// Geography. Only safety-reviewed coarse geometry is ever stored on an
// incident. Exact coordinates for active kinetic events are never extracted,
// persisted, or projected (see docs/SAFETY.md).
// ---------------------------------------------------------------------------

export type LocationPrecision =
  | "country"
  | "admin-region"
  | "district"
  | "city"
  | "coarse-cell";

export interface PublicLocation {
  /** Human label, e.g. "Northern Kessel Province". */
  name: string;
  countryCode: string;
  precision: LocationPrecision;
  /** Generalized centroid — already coarse; additionally rounded on projection. */
  lat: number;
  lon: number;
  /** Public uncertainty radius around the generalized point. */
  uncertaintyKm: number;
  /** Why the location is shown at this precision. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Sources, articles, claims.
// ---------------------------------------------------------------------------

export type SourceType =
  | "official-government"
  | "official-military"
  | "international-organization"
  | "wire-service"
  | "national-outlet"
  | "local-outlet"
  | "humanitarian-ngo"
  | "aggregator";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  /** Domain/channel allowlist entries. */
  domains: string[];
  languages: string[];
  licenseNotes: string;
  attributionRequirements: string;
  refreshIntervalMinutes: number;
  parserVersion: string;
  health: "healthy" | "degraded" | "disabled";
  reliabilityNotes: string;
  editorialApproval: "approved" | "pending" | "rejected";
  /** Aggregators are discovery signals, never evidence or corroboration. */
  countsAsEvidence: boolean;
}

export interface Article {
  id: string;
  sourceId: string;
  url: string;
  canonicalUrl: string;
  publisher: string;
  title: string;
  language: string;
  publishedAt: string; // ISO 8601 UTC
  retrievedAt: string;
  contentHash: string;
  /** Set when this article is a syndicated copy of another publisher's report. */
  syndicatedFromArticleId?: string;
  /** Set when this article is a translation of another article. */
  translationOfArticleId?: string;
}

export interface Claim {
  id: string;
  articleId: string;
  incidentId: string;
  /** What the claim asserts, in neutral wording with attribution. */
  text: string;
  /** Permitted short excerpt from the source (license-bounded). */
  excerpt: string;
  /** Passage locator or content hash so the excerpt is re-findable. */
  passageLocator: string;
  kind: "fact-report" | "official-claim" | "casualty-estimate" | "denial";
}

export interface AttributedEstimate {
  /** e.g. "Velmar health ministry" */
  attributedTo: string;
  /** e.g. "12–18 injured reported" — always a sourced range/estimate. */
  text: string;
}

// ---------------------------------------------------------------------------
// Incidents (internal record — includes fields that never leave the server).
// ---------------------------------------------------------------------------

export interface SafetyEmbargo {
  /** Earliest UTC instant public publication is permitted. */
  publishNotBefore: string;
  /** Editors may extend indefinitely; expiry alone never publishes. */
  extendedByEditor: boolean;
  reason: string;
}

export interface CorrectionRecord {
  at: string;
  summary: string;
}

export interface IncidentUpdate {
  at: string;
  text: string;
}

export interface Incident {
  id: string;
  headline: string;
  summary: string;
  category: IncidentCategory;
  conflictId?: string;
  tags: string[];

  /** Best-known local event time, with stated precision. */
  eventTime: string;
  eventTimePrecision: "exact" | "hour" | "part-of-day" | "day";
  /** IANA zone of the event locale, for local-time display. */
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

  /** Separate evidence sections — never blended into one narrative. */
  confirmedFacts: string[];
  attributedClaims: string[];
  disputedPoints: string[];
  unknowns: string[];
  casualtyEstimates: AttributedEstimate[];

  claimIds: string[];
  /** Computed: distinct original publishers, excluding syndication/aggregators. */
  independentSourceCount: number;

  relatedIncidentIds: string[];
  briefingId?: string;

  embargo: SafetyEmbargo;
  /** Server-side risk gate can withhold even after embargo expiry. */
  riskWithheld: boolean;
  riskWithheldReason?: string;

  updatesLog: IncidentUpdate[];
  corrections: CorrectionRecord[];

  sensitiveContent: boolean;
  /** True for the seeded fictional demo scenario. */
  demo: boolean;

  // -- Internal-only fields (never projected) -------------------------------
  internalNotes?: string;
  confidenceScoreInternal?: number;
}

// ---------------------------------------------------------------------------
// News story clusters.
// ---------------------------------------------------------------------------

export type NewsBadge = "breaking" | "analysis" | "official-statement" | null;

export interface NewsCluster {
  id: string;
  headline: string;
  summary: string;
  region: string;
  countryCode?: string;
  category: "conflict" | "diplomacy" | "humanitarian" | "official";
  badge: NewsBadge;
  eventTime?: string;
  publishedAt: string;
  leadPublisher: string;
  articleIds: string[];
  independentSourceCount: number;
  verification: Verification;
  maturity: Maturity;
  dispute: DisputeState;
  lifecycle: Lifecycle;
  confidence: Confidence;
  relatedIncidentId?: string;
  /** Explainable significance used by "Most significant" sort. */
  significance: number;
  significanceFactors: string[];
  demo: boolean;
}

// ---------------------------------------------------------------------------
// Official addresses & press briefings.
// ---------------------------------------------------------------------------

export type AddressState =
  | "upcoming"
  | "live"
  | "ended"
  | "cancelled"
  | "replay-available"
  | "replay-unavailable";

export interface TranscriptSegment {
  atSeconds: number;
  speaker: string;
  text: string;
}

export interface OfficialAddress {
  id: string;
  title: string;
  speaker: string;
  office: string;
  countryOrOrg: string;
  topic: string;
  originalLanguage: string;
  scheduledAtUtc: string;
  durationMinutes?: number;
  state: AddressState;
  officialSourceName: string;
  officialSourceUrl: string;
  /** Only set when the official stream is legally embeddable. */
  embeddablePlayerUrl?: string;
  transcript?: TranscriptSegment[];
  translatedSummary?: string;
  keyAnnouncements: string[];
  citedIncidentIds: string[];
  demo: boolean;
}

// ---------------------------------------------------------------------------
// Briefings.
// ---------------------------------------------------------------------------

export interface BriefingClaim {
  text: string;
  sourceArticleIds: string[];
}

export interface Briefing {
  id: string;
  kind: "sunrise" | "sunset" | "regional";
  title: string;
  region?: string;
  coverageWindowStart: string;
  coverageWindowEnd: string;
  publishedAt: string;
  updatedAt: string;
  /** e.g. "AI-assisted draft, editor-reviewed" — always shown. */
  authoringMethod: string;
  summary60s: string;
  topDevelopments: BriefingClaim[];
  changedSincePrior: BriefingClaim[];
  majorIncidentIds: string[];
  diplomaticDevelopments: BriefingClaim[];
  humanitarianImpact: BriefingClaim[];
  conflictingReports: BriefingClaim[];
  whatToWatch: BriefingClaim[];
  corrections: CorrectionRecord[];
  demo: boolean;
}

// ---------------------------------------------------------------------------
// Conflicts & countries (fictional in demo mode).
// ---------------------------------------------------------------------------

export interface Conflict {
  id: string;
  name: string;
  region: string;
  countryCodes: string[];
  summary: string;
  demo: boolean;
}

export interface Country {
  code: string;
  name: string;
  region: string;
  demo: boolean;
}
