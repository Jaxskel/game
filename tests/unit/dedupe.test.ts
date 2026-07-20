import { describe, expect, it } from "vitest";
import { countIndependentSources, normalizeCanonicalUrl } from "@/lib/domain/dedupe";
import { buildFixtures, articleIdsForIncident } from "@/lib/domain/fixtures";

const NOW = new Date("2026-07-20T12:00:00Z");

describe("normalizeCanonicalUrl", () => {
  it("strips tracking params, fragments, and trailing slashes", () => {
    expect(
      normalizeCanonicalUrl("https://News.example/story/?utm_source=x&id=7#frag"),
    ).toBe("https://news.example/story?id=7");
  });
});

describe("countIndependentSources", () => {
  const fx = buildFixtures(NOW);
  const sourcesById = new Map(fx.sources.map((s) => [s.id, s]));
  const articlesById = new Map(fx.articles.map((a) => [a.id, a]));
  const articlesFor = (incidentId: string) =>
    articleIdsForIncident(fx, incidentId)
      .map((id) => articlesById.get(id))
      .filter((a) => a !== undefined);

  it("excludes syndicated copies, aggregator records, and conflict-party official statements", () => {
    // Kessel strike: 6 articles — wire original, second outlet, syndicated
    // copy, two party statements, one aggregator record → 2 independent.
    expect(countIndependentSources(articlesFor("inc-kessel-strike"), sourcesById)).toBe(2);
  });

  it("counts a lone original report as exactly one", () => {
    expect(countIndependentSources(articlesFor("inc-drone-havren"), sourcesById)).toBe(1);
  });

  it("does not double-count repeat articles from the same publisher", () => {
    const wire = articlesFor("inc-drone-havren");
    const doubled = [...wire, { ...wire[0], id: "art-dup", contentHash: "h-dup" }];
    expect(countIndependentSources(doubled, sourcesById)).toBe(1);
  });

  it("excludes translations of an already-counted article", () => {
    const wire = articlesFor("inc-drone-havren");
    const withTranslation = [
      ...wire,
      { ...wire[0], id: "art-tr", contentHash: "h-tr", translationOfArticleId: wire[0].id },
    ];
    expect(countIndependentSources(withTranslation, sourcesById)).toBe(1);
  });
});
