import "server-only";
import type { Article, Source } from "@/lib/domain/types";

/**
 * Source-adapter provider interface.
 *
 * Every ingestion source implements this interface. In production, adapters
 * run inside queue workers behind the SSRF-safe fetcher; here the fixture
 * adapter is fully functional and every live adapter is an explicit
 * `blocked` stub — implemented, typed, and honest about why it cannot run
 * (missing credentials / license confirmation). See docs/HANDOFF.md for the
 * exact steps to take each live adapter to `verified against a live provider`.
 */

export type AdapterAvailability =
  | { state: "ready" }
  | { state: "blocked"; reason: string };

export interface FetchResult {
  articles: Article[];
  /** Aggregator adapters return discovery signals, never evidence. */
  discoveryOnly: boolean;
}

export interface SourceAdapter {
  id: string;
  describe(): Pick<Source, "name" | "type" | "licenseNotes">;
  availability(): AdapterAvailability;
  /** Fetch new documents since the given instant. Must be idempotent. */
  fetchSince(sinceIso: string): Promise<FetchResult>;
}

function blocked(reason: string): AdapterAvailability {
  return { state: "blocked", reason };
}

function blockedAdapter(
  id: string,
  name: string,
  type: Source["type"],
  licenseNotes: string,
  reason: string,
): SourceAdapter {
  return {
    id,
    describe: () => ({ name, type, licenseNotes }),
    availability: () => blocked(reason),
    fetchSince: async () => {
      throw new Error(`Adapter ${id} is blocked: ${reason}`);
    },
  };
}

/** GDELT — discovery/clustering signal only; never evidence or corroboration. */
export const gdeltAdapter = blockedAdapter(
  "gdelt",
  "GDELT",
  "aggregator",
  "Aggregator metadata only; resolve every record to its original publisher.",
  "Live verification requires network approval for api.gdeltproject.org and an operator decision on query scope. Interface + fixtures implemented; live call BLOCKED.",
);

/** ACLED — only with valid credentials and license terms permitting this use. */
export const acledAdapter = blockedAdapter(
  "acled",
  "ACLED",
  "aggregator",
  "Licensed dataset. Terms must be confirmed before any use.",
  "No ACLED_API_KEY/ACLED_EMAIL configured and license terms unconfirmed. BLOCKED until the operator supplies credentials and confirms the license permits this product.",
);

/** ReliefWeb/OCHA humanitarian reports. */
export const reliefwebAdapter = blockedAdapter(
  "reliefweb",
  "ReliefWeb (OCHA)",
  "humanitarian-ngo",
  "Open API with attribution requirements.",
  "Live verification requires network approval for api.reliefweb.int. Interface + fixtures implemented; live call BLOCKED.",
);

/** YouTube Data API — editor-approved allowlist of official channels only. */
export const youtubeAdapter = blockedAdapter(
  "youtube-official",
  "YouTube Data API (official-channel allowlist)",
  "official-government",
  "Metadata + legal embeds only; no downloading or republishing.",
  "No YOUTUBE_API_KEY configured and no editor-approved channel allowlist yet. BLOCKED.",
);

/** GDACS — disaster context only, never conflict or strike evidence. */
export const gdacsAdapter = blockedAdapter(
  "gdacs",
  "GDACS",
  "international-organization",
  "Disaster-context feed; labeled separately from conflict reporting.",
  "Live verification requires network approval for gdacs.org. BLOCKED.",
);

/** Fixture adapter — fully functional; source of the demo dataset. */
export const fixtureAdapter: SourceAdapter = {
  id: "fixtures",
  describe: () => ({
    name: "Demo fixtures (fictional scenario)",
    type: "wire-service",
    licenseNotes: "Invented demo content; no license constraints.",
  }),
  availability: () => ({ state: "ready" }),
  fetchSince: async () => {
    const { buildFixtures } = await import("@/lib/domain/fixtures");
    return { articles: buildFixtures(new Date()).articles, discoveryOnly: false };
  },
};

export const allAdapters: SourceAdapter[] = [
  fixtureAdapter,
  gdeltAdapter,
  acledAdapter,
  reliefwebAdapter,
  youtubeAdapter,
  gdacsAdapter,
];
