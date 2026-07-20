import type { Article, Source } from "./types";

/**
 * Canonical-URL normalization: strip tracking params, fragments, trailing
 * slashes, and lowercase the host so syndicated re-posts of the same URL
 * collapse together.
 */
export function normalizeCanonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const params = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!/^(utm_|fbclid|gclid|ref|cmpid|s=)/i.test(k)) params.set(k, v);
    }
    u.search = params.toString();
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url;
  }
}

/**
 * Count genuinely independent sources behind a set of articles.
 *
 * Excluded from the count:
 *  - syndicated copies (they trace back to the original publisher)
 *  - translations of an already-counted article
 *  - exact content-hash duplicates
 *  - aggregator records (discovery signals, not evidence)
 *  - repeat articles from an already-counted publisher
 */
export function countIndependentSources(
  articles: Article[],
  sourcesById: Map<string, Source>,
): number {
  const seenPublishers = new Set<string>();
  const seenHashes = new Set<string>();

  for (const a of articles) {
    const source = sourcesById.get(a.sourceId);
    if (!source || !source.countsAsEvidence) continue;
    if (a.syndicatedFromArticleId || a.translationOfArticleId) continue;
    if (seenHashes.has(a.contentHash)) continue;
    seenHashes.add(a.contentHash);
    seenPublishers.add(a.publisher.toLowerCase());
  }
  return seenPublishers.size;
}

/**
 * Group articles into story clusters by canonical URL and content hash.
 * (Semantic/entity/temporal clustering runs upstream in production ingestion;
 * this is the deterministic final-pass dedup used by the demo pipeline.)
 */
export function clusterArticles(articles: Article[]): Article[][] {
  const byKey = new Map<string, Article[]>();
  for (const a of articles) {
    const key = a.contentHash || normalizeCanonicalUrl(a.canonicalUrl);
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }
  return [...byKey.values()];
}
