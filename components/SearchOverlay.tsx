"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResults } from "@/lib/domain/store";
import { prefs } from "@/lib/client/prefs";

/**
 * Full-screen mobile search surface with grouped results. Selecting an
 * incident returns to the map at its generalized location; other results
 * navigate to their detail routes.
 */
export function SearchOverlay({
  onClose,
  onSelectIncident,
}: {
  onClose: () => void;
  onSelectIncident: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    setRecent(prefs.getRecentSearches());
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((data) => setResults(data.results ?? null))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  function commitSearch(term: string) {
    prefs.addRecentSearch(term);
    setRecent(prefs.getRecentSearches());
  }

  const empty =
    results &&
    Object.values(results).every((group) => Array.isArray(group) && group.length === 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "var(--bg)", paddingTop: "var(--sat)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center gap-2 border-b p-3" style={{ borderColor: "var(--border)" }}>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder="Countries, conflicts, incidents, leaders…"
          className="h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur(); // dismiss mobile keyboard
              if (q.trim()) commitSearch(q.trim());
            }
          }}
        />
        <button type="button" className="tap chip px-4" onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24">
        {q.trim().length < 2 ? (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Recent searches</h2>
              {recent.length > 0 ? (
                <button
                  type="button"
                  className="tap chip"
                  onClick={() => {
                    prefs.clearRecentSearches();
                    setRecent([]);
                  }}
                >
                  Clear history
                </button>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                Search countries, regions, conflicts, cities, organizations,
                incident types, or headlines.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" className="tap w-full justify-start text-sm" onClick={() => setQ(r)}>
                      ↺ {r}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : loading && !results ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Searching…
          </p>
        ) : empty ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            <p>No results for “{q}”.</p>
            <p className="mt-2">
              Try a country name (e.g. “Ardenia”), a conflict (“Kessel”), or a
              category (“ceasefire”).
            </p>
          </div>
        ) : results ? (
          <div className="space-y-5">
            {results.incidents.length > 0 ? (
              <ResultGroup title="Incidents">
                {results.incidents.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="card block w-full p-3 text-left text-sm"
                    onClick={() => {
                      commitSearch(q.trim());
                      onSelectIncident(i.id);
                    }}
                  >
                    <span className="font-semibold">{i.headline}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                      {i.location.name}
                    </span>
                  </button>
                ))}
              </ResultGroup>
            ) : null}
            {results.addresses.length > 0 ? (
              <ResultGroup title="Official addresses">
                {results.addresses.map((a) => (
                  <Link
                    key={a.id}
                    href={`/addresses/${a.id}`}
                    className="card block p-3 text-sm"
                    onClick={() => commitSearch(q.trim())}
                  >
                    <span className="font-semibold">{a.title}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                      {a.speaker} · {a.countryOrOrg} · {a.state}
                    </span>
                  </Link>
                ))}
              </ResultGroup>
            ) : null}
            {results.news.length > 0 ? (
              <ResultGroup title="News">
                {results.news.map((n) => (
                  <Link
                    key={n.id}
                    href="/feed"
                    className="card block p-3 text-sm"
                    onClick={() => commitSearch(q.trim())}
                  >
                    <span className="font-semibold">{n.headline}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                      {n.leadPublisher} · {n.region}
                    </span>
                  </Link>
                ))}
              </ResultGroup>
            ) : null}
            {results.briefings.length > 0 ? (
              <ResultGroup title="Briefings">
                {results.briefings.map((b) => (
                  <Link
                    key={b.id}
                    href={`/briefings/${b.id}`}
                    className="card block p-3 text-sm"
                    onClick={() => commitSearch(q.trim())}
                  >
                    <span className="font-semibold">{b.title}</span>
                  </Link>
                ))}
              </ResultGroup>
            ) : null}
            {results.conflicts.length > 0 || results.countries.length > 0 ? (
              <ResultGroup title="Conflicts & countries">
                {results.conflicts.map((c) => (
                  <div key={c.id} className="card p-3 text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                      {c.region}
                    </span>
                  </div>
                ))}
                {results.countries.map((c) => (
                  <div key={c.code} className="card p-3 text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                      {c.region}
                    </span>
                  </div>
                ))}
              </ResultGroup>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
