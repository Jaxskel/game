import { computeConfidence } from "./confidence";
import { countIndependentSources } from "./dedupe";
import { articleIdsForIncident, buildFixtures } from "./fixtures";
import {
  projectIncident,
  type PublicIncidentProjection,
  type PublicIncidentSource,
} from "./projection";
import type {
  Briefing,
  ConfidenceBand,
  Conflict,
  Country,
  IncidentCategory,
  NewsCluster,
  OfficialAddress,
  Source,
  Verification,
} from "./types";

/**
 * In-memory store for demo/fixture mode. In the reference production
 * architecture this layer is PostgreSQL+PostGIS behind the same query
 * interface (see docs/ARCHITECTURE.md); everything above it — API routes,
 * projections, UI — is storage-agnostic.
 *
 * The store holds ONLY public projections of incidents. Internal incident
 * records never leave `buildStore`.
 */

/** Public reference to a published article — metadata only, used for claim
 * lineage links in briefings. */
export interface PublicArticleRef {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
}

export interface Store {
  builtAt: string;
  dataMode: "demo";
  incidents: PublicIncidentProjection[];
  incidentsById: Map<string, PublicIncidentProjection>;
  newsClusters: NewsCluster[];
  addresses: OfficialAddress[];
  briefings: Briefing[];
  conflicts: Conflict[];
  countries: Country[];
  sources: Source[];
  articleRefs: Map<string, PublicArticleRef>;
}

export function buildStore(now: Date): Store {
  const fx = buildFixtures(now);
  const sourcesById = new Map(fx.sources.map((s) => [s.id, s]));
  const articlesById = new Map(fx.articles.map((a) => [a.id, a]));

  const incidents: PublicIncidentProjection[] = [];

  for (const incident of fx.incidents) {
    const articleIds = articleIdsForIncident(fx, incident.id);
    const articles = articleIds
      .map((id) => articlesById.get(id))
      .filter((a) => a !== undefined);

    // Pipeline: independent corroboration → verification axis.
    const independent = countIndependentSources(articles, sourcesById);
    incident.independentSourceCount = independent;
    incident.verification =
      independent >= 2 ? "corroborated" : independent === 1 ? "single-source" : "unverified";

    // Pipeline: explainable confidence (band + rationale public, score internal).
    const conf = computeConfidence({
      independentSourceCount: independent,
      hasPrimaryEvidence: incident.confirmedFacts.length > 0,
      officialClaimPresent: incident.provenance.officialClaimPresent,
      contradictionCount: incident.disputedPoints.length,
      geographicClarity:
        incident.location.precision === "city" || incident.location.precision === "district"
          ? "clear"
          : incident.location.precision === "admin-region"
            ? "approximate"
            : "vague",
      editorReviewed: incident.maturity === "stable",
    });
    incident.confidence = {
      band: conf.band,
      rationale: conf.rationale,
      version: conf.version,
    };
    incident.confidenceScoreInternal = conf.scoreInternal;

    // Public source list: real coverage only — aggregator records are
    // discovery signals and never appear as supporting sources.
    const claimByArticle = new Map(
      fx.claims.filter((c) => c.incidentId === incident.id).map((c) => [c.articleId, c]),
    );
    const publicSources: PublicIncidentSource[] = articles
      .filter((a) => sourcesById.get(a.sourceId)?.type !== "aggregator")
      .map((a) => {
        const claim = claimByArticle.get(a.id);
        return {
          publisher: a.publisher,
          sourceType: sourcesById.get(a.sourceId)?.type ?? "unknown",
          url: a.url,
          publishedAt: a.publishedAt,
          supportsClaim: claim?.text ?? "Coverage of this incident",
          excerpt: claim?.excerpt ?? "",
        };
      });

    // Safety gate + projection. Withheld incidents simply do not exist
    // in the store — nothing downstream can leak them.
    const projected = projectIncident(incident, publicSources, now);
    if (projected) incidents.push(projected);
  }

  incidents.sort((a, b) => b.eventTime.localeCompare(a.eventTime));

  // Keep news-cluster labels coherent with their pipeline-derived incident.
  const incidentsById = new Map(incidents.map((i) => [i.id, i]));
  const newsClusters = fx.newsClusters
    .map((c) => {
      const inc = c.relatedIncidentId ? incidentsById.get(c.relatedIncidentId) : undefined;
      if (!inc) return c;
      return {
        ...c,
        verification: inc.verification,
        dispute: inc.dispute,
        lifecycle: inc.lifecycle,
        confidence: inc.confidence,
        independentSourceCount: inc.independentSourceCount,
      };
    })
    // A cluster whose only incident is withheld is withheld with it,
    // unless the cluster stands on its own published articles.
    .filter(
      (c) => !c.relatedIncidentId || incidentsById.has(c.relatedIncidentId),
    );

  newsClusters.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const articleRefs = new Map<string, PublicArticleRef>(
    fx.articles.map((a) => [
      a.id,
      {
        id: a.id,
        publisher: a.publisher,
        title: a.title,
        url: a.url,
        publishedAt: a.publishedAt,
      },
    ]),
  );

  return {
    builtAt: now.toISOString(),
    dataMode: "demo",
    incidents,
    incidentsById,
    newsClusters,
    addresses: fx.addresses,
    briefings: fx.briefings,
    conflicts: fx.conflicts,
    countries: fx.countries,
    sources: fx.sources,
    articleRefs,
  };
}

// ---------------------------------------------------------------------------
// Memoized store (rebuilds every few minutes so address/embargo states move).
// ---------------------------------------------------------------------------

const STORE_TTL_MS = 5 * 60_000;
let cached: { store: Store; at: number } | null = null;

export function getStore(): Store {
  const nowMs = Date.now();
  if (!cached || nowMs - cached.at > STORE_TTL_MS) {
    cached = { store: buildStore(new Date(nowMs)), at: nowMs };
  }
  return cached.store;
}

// ---------------------------------------------------------------------------
// Queries.
// ---------------------------------------------------------------------------

export interface IncidentQuery {
  category?: IncidentCategory;
  conflictId?: string;
  countryCode?: string;
  verification?: Verification;
  confidence?: ConfidenceBand;
  /** Only incidents whose event time falls within the last N hours. */
  sinceHours?: number;
  q?: string;
  cursor?: number;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: number | null;
  total: number;
}

function paginate<T>(items: T[], cursor = 0, limit = 50): Page<T> {
  const slice = items.slice(cursor, cursor + limit);
  const next = cursor + limit < items.length ? cursor + limit : null;
  return { items: slice, nextCursor: next, total: items.length };
}

function textMatch(haystack: string[], q: string): boolean {
  const needle = q.toLowerCase();
  return haystack.some((h) => h.toLowerCase().includes(needle));
}

export function queryIncidents(store: Store, query: IncidentQuery): Page<PublicIncidentProjection> {
  const cutoff =
    query.sinceHours !== undefined
      ? new Date(new Date(store.builtAt).getTime() - query.sinceHours * 3_600_000).toISOString()
      : null;

  const filtered = store.incidents.filter((i) => {
    if (query.category && i.category !== query.category) return false;
    if (query.conflictId && i.conflictId !== query.conflictId) return false;
    if (query.countryCode && i.location.countryCode !== query.countryCode) return false;
    if (query.verification && i.verification !== query.verification) return false;
    if (query.confidence && i.confidence.band !== query.confidence) return false;
    if (cutoff && i.eventTime < cutoff) return false;
    if (
      query.q &&
      !textMatch([i.headline, i.summary, i.location.name, ...i.tags], query.q)
    )
      return false;
    return true;
  });

  return paginate(filtered, query.cursor, query.limit);
}

export interface NewsQuery {
  tab?: "all" | "breaking" | "diplomacy" | "humanitarian" | "official";
  q?: string;
  sort?: "latest" | "significance";
  cursor?: number;
  limit?: number;
}

export function queryNews(store: Store, query: NewsQuery): Page<NewsCluster> {
  let items = store.newsClusters.filter((c) => {
    switch (query.tab) {
      case "breaking":
        return c.badge === "breaking";
      case "diplomacy":
        return c.category === "diplomacy";
      case "humanitarian":
        return c.category === "humanitarian";
      case "official":
        return c.category === "official" || c.badge === "official-statement";
      default:
        return true;
    }
  });
  if (query.q) {
    items = items.filter((c) =>
      textMatch([c.headline, c.summary, c.region, c.leadPublisher], query.q!),
    );
  }
  if (query.sort === "significance") {
    items = [...items].sort((a, b) => b.significance - a.significance);
  }
  return paginate(items, query.cursor, query.limit);
}

export interface SearchResults {
  incidents: PublicIncidentProjection[];
  news: NewsCluster[];
  addresses: OfficialAddress[];
  briefings: Briefing[];
  conflicts: Conflict[];
  countries: Country[];
}

export function search(store: Store, q: string): SearchResults {
  const limit = 5;
  return {
    incidents: store.incidents
      .filter((i) => textMatch([i.headline, i.summary, i.location.name, ...i.tags], q))
      .slice(0, limit),
    news: store.newsClusters
      .filter((c) => textMatch([c.headline, c.summary, c.region], q))
      .slice(0, limit),
    addresses: store.addresses
      .filter((a) => textMatch([a.title, a.speaker, a.countryOrOrg, a.topic], q))
      .slice(0, limit),
    briefings: store.briefings
      .filter((b) => textMatch([b.title, b.region ?? "", b.summary60s], q))
      .slice(0, limit),
    conflicts: store.conflicts
      .filter((c) => textMatch([c.name, c.region, c.summary], q))
      .slice(0, limit),
    countries: store.countries
      .filter((c) => textMatch([c.name, c.region], q))
      .slice(0, limit),
  };
}
