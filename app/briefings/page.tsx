import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/domain/store";
import { formatUtc, relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Briefings" };

// Briefing recency must reflect request time, not build time.
export const dynamic = "force-dynamic";

const KIND_GLYPH: Record<string, string> = {
  sunrise: "🌅",
  sunset: "🌇",
  regional: "🗺",
};

export default function BriefingsPage() {
  const store = getStore();
  const briefings = [...store.briefings].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );

  return (
    <div className="mx-auto w-full max-w-2xl p-3">
      <h1 className="px-1 py-2 text-xl font-bold">Briefings</h1>
      <p className="px-1 pb-3 text-sm" style={{ color: "var(--muted)" }}>
        Twice-daily and regional summaries with claim-level sources. AI-assisted
        text is always labeled and editor-reviewed.
      </p>
      <ul className="space-y-2">
        {briefings.map((b) => (
          <li key={b.id}>
            <Link href={`/briefings/${b.id}`} className="card block p-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-xl">
                  {KIND_GLYPH[b.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-bold">
                    {b.title}
                    {b.region ? ` — ${b.region}` : ""}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Published {relativeTime(b.publishedAt)} · Covers{" "}
                    {formatUtc(b.coverageWindowStart)} → {formatUtc(b.coverageWindowEnd)}
                  </p>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm" style={{ color: "var(--muted)" }}>
                {b.summary60s}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
