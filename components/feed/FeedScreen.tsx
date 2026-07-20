"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LabelRow } from "@/components/Labels";
import { SearchOverlay } from "@/components/SearchOverlay";
import { useRouter } from "next/navigation";
import type { NewsCluster, OfficialAddress } from "@/lib/domain/types";
import { formatUtc, relativeTime } from "@/lib/format";
import { prefs } from "@/lib/client/prefs";
import { AddressCard } from "@/components/addresses/AddressCard";

type PrimaryTab = "all" | "following" | "breaking" | "diplomacy" | "humanitarian" | "official";
type Surface = "news" | "addresses";

const PRIMARY_TABS: { key: PrimaryTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "following", label: "Following" },
  { key: "breaking", label: "Breaking" },
  { key: "diplomacy", label: "Diplomacy" },
  { key: "humanitarian", label: "Humanitarian" },
  { key: "official", label: "Official" },
];

function badgeLabel(badge: NewsCluster["badge"]): string | null {
  switch (badge) {
    case "breaking":
      return "Breaking";
    case "analysis":
      return "Analysis";
    case "official-statement":
      return "Official statement";
    default:
      return null;
  }
}

export function FeedScreen() {
  const router = useRouter();
  const [surface, setSurface] = useState<Surface>(() => {
    if (typeof window === "undefined") return "news";
    return new URLSearchParams(window.location.search).get("s") === "addresses"
      ? "addresses"
      : "news";
  });
  const [tab, setTab] = useState<PrimaryTab>(() => {
    if (typeof window === "undefined") return "all";
    return (new URLSearchParams(window.location.search).get("tab") as PrimaryTab) || "all";
  });
  const [sort, setSort] = useState<"latest" | "significance">("latest");
  const [clusters, setClusters] = useState<NewsCluster[] | null>(null);
  const [addresses, setAddresses] = useState<OfficialAddress[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Persist tab state in the URL so opening a detail and going back
  // preserves the filter context.
  useEffect(() => {
    const p = new URLSearchParams();
    if (surface === "addresses") p.set("s", "addresses");
    if (tab !== "all") p.set("tab", tab);
    const qs = p.toString();
    window.history.replaceState(window.history.state, "", qs ? `/feed?${qs}` : "/feed");
  }, [surface, tab]);

  useEffect(() => {
    const apiTab = tab === "following" || tab === "all" ? "all" : tab;
    fetch(`/api/v1/news?tab=${apiTab}&sort=${sort}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setClusters(data.items ?? []);
        setLastUpdated(data.lastUpdated ?? null);
      })
      .catch(() => setClusters([]));
  }, [tab, sort]);

  useEffect(() => {
    fetch("/api/v1/addresses")
      .then((r) => r.json())
      .then((data) => setAddresses(data.items ?? []))
      .catch(() => setAddresses([]));
  }, []);

  const followedClusters = useMemo(() => {
    if (!clusters || tab !== "following") return clusters;
    const follows = prefs.getFollows();
    if (follows.length === 0) return [];
    return clusters.filter((c) =>
      follows.some(
        (f) =>
          (f.kind === "country" && c.countryCode === f.id) ||
          (f.kind === "region" && c.region === f.id) ||
          (f.kind === "topic" && c.category === f.id),
      ),
    );
  }, [clusters, tab]);

  const liveCount = addresses?.filter((a) => a.state === "live").length ?? 0;
  const upcomingCount = addresses?.filter((a) => a.state === "upcoming").length ?? 0;

  const shown = tab === "following" ? followedClusters : clusters;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Secondary surface tabs: News | Official Addresses */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1 px-3 pt-2">
          <div role="tablist" aria-label="Feed sections" className="flex flex-1 gap-1">
            <button
              role="tab"
              aria-selected={surface === "news"}
              className={`tap flex-1 rounded-t-lg text-sm font-semibold ${surface === "news" ? "" : "opacity-60"}`}
              style={surface === "news" ? { borderBottom: "2px solid var(--accent)" } : undefined}
              onClick={() => setSurface("news")}
            >
              News
            </button>
            <button
              role="tab"
              aria-selected={surface === "addresses"}
              className={`tap flex-1 rounded-t-lg text-sm font-semibold ${surface === "addresses" ? "" : "opacity-60"}`}
              style={
                surface === "addresses" ? { borderBottom: "2px solid var(--accent)" } : undefined
              }
              onClick={() => setSurface("addresses")}
            >
              Official Addresses
              {liveCount > 0 ? (
                <span className="chip ml-1.5" style={{ borderColor: "var(--live)", color: "var(--live)" }}>
                  <span className="live-dot" aria-hidden="true" /> {liveCount} live
                </span>
              ) : upcomingCount > 0 ? (
                <span className="chip ml-1.5">{upcomingCount} upcoming</span>
              ) : null}
            </button>
          </div>
          <button
            type="button"
            className="tap"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            🔍
          </button>
        </div>

        {surface === "news" ? (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2">
            {PRIMARY_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tap chip ${tab === t.key ? "chip-active" : ""}`}
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              className="tap chip ml-auto"
              aria-label={`Sort: ${sort === "latest" ? "latest first" : "most significant first"}`}
              onClick={() => setSort((s) => (s === "latest" ? "significance" : "latest"))}
            >
              ⇅ {sort === "latest" ? "Latest" : "Most significant"}
            </button>
          </div>
        ) : null}
      </div>

      {surface === "news" ? (
        <div className="space-y-2 p-3">
          {lastUpdated ? (
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              Updated {relativeTime(lastUpdated)}
              {sort === "significance"
                ? " · Significance weighs corroboration, scale, and policy impact — factors are listed on each card."
                : ""}
            </p>
          ) : null}
          {shown === null ? (
            <FeedSkeleton />
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-sm" style={{ color: "var(--muted)" }}>
              {tab === "following"
                ? "You aren't following any topics yet — add some in the Watchlist tab."
                : "Nothing here right now."}
            </p>
          ) : (
            shown.map((c) => <NewsCard key={c.id} cluster={c} sort={sort} />)
          )}
        </div>
      ) : (
        <div className="space-y-2 p-3">
          {addresses === null ? (
            <FeedSkeleton />
          ) : (
            addresses.map((a) => <AddressCard key={a.id} address={a} />)
          )}
        </div>
      )}

      {searchOpen ? (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onSelectIncident={(id) => router.push(`/incident/${id}`)}
        />
      ) : null}
    </div>
  );
}

function NewsCard({ cluster, sort }: { cluster: NewsCluster; sort: string }) {
  const badge = badgeLabel(cluster.badge);
  const inner = (
    <article className="card p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        {badge ? (
          <span
            className="chip font-semibold"
            style={
              cluster.badge === "breaking"
                ? { borderColor: "var(--live)", color: "var(--live)" }
                : undefined
            }
          >
            {badge}
          </span>
        ) : null}
        <span>{cluster.region}</span>
        <span aria-hidden="true">·</span>
        <span>{cluster.leadPublisher}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={cluster.publishedAt}>published {relativeTime(cluster.publishedAt)}</time>
        {cluster.eventTime ? (
          <>
            <span aria-hidden="true">·</span>
            <span>event {formatUtc(cluster.eventTime)}</span>
          </>
        ) : null}
      </div>
      <h2 className="mt-1.5 text-[15px] font-bold leading-snug">{cluster.headline}</h2>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {cluster.summary}
      </p>
      <div className="mt-2">
        <LabelRow
          verification={cluster.verification}
          maturity={cluster.maturity}
          dispute={cluster.dispute}
          lifecycle={cluster.lifecycle}
          confidence={cluster.confidence}
        />
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        {cluster.independentSourceCount} independent source
        {cluster.independentSourceCount === 1 ? "" : "s"} ·{" "}
        {cluster.articleIds.length} linked report{cluster.articleIds.length === 1 ? "" : "s"}
        {sort === "significance" ? ` · Why ranked: ${cluster.significanceFactors.join("; ")}` : ""}
      </p>
    </article>
  );
  return cluster.relatedIncidentId ? (
    <Link href={`/incident/${cluster.relatedIncidentId}`} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-28 animate-pulse p-3" style={{ opacity: 0.5 }} />
      ))}
    </div>
  );
}
