"use client";

import { TEAMS } from "@/lib/worldcup/data";
import type { MatchState, TeamStats } from "@/lib/worldcup/types";

const ROWS: { label: string; get: (s: TeamStats) => string | number }[] = [
  { label: "Shots", get: (s) => s.shots },
  { label: "On target", get: (s) => s.shotsOnTarget },
  { label: "xG (est.)", get: (s) => s.xg.toFixed(2) },
  { label: "Corners", get: (s) => s.corners },
  { label: "Offsides", get: (s) => s.offsides },
  { label: "Fouls", get: (s) => s.fouls },
  { label: "Yellow cards", get: (s) => s.yellows },
  { label: "Red cards", get: (s) => s.reds },
  { label: "Saves", get: (s) => s.saves },
];

export default function StatTiles({ state }: { state: MatchState }) {
  const eng = state.stats.ENG;
  const arg = state.stats.ARG;

  return (
    <section className="wc-card p-4" aria-label="Live match statistics">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--wc-eng)" }} />
          {TEAMS.ENG.short}
        </span>
        <span style={{ color: "var(--wc-text-2)" }}>Match stats</span>
        <span className="flex items-center gap-1.5">
          {TEAMS.ARG.short}
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--wc-arg)" }} />
        </span>
      </div>

      {/* Possession bar — 2px gap between the two fills */}
      <div className="mt-3">
        <div className="flex justify-between text-xs" style={{ color: "var(--wc-muted)" }}>
          <span className="wc-num">{eng.possession}%</span>
          <span>Possession</span>
          <span className="wc-num">{arg.possession}%</span>
        </div>
        <div className="mt-1 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
          <div
            className="rounded-l-full transition-[width] duration-500"
            style={{ width: `${eng.possession}%`, background: "var(--wc-eng)" }}
          />
          <div
            className="flex-1 rounded-r-full transition-[width] duration-500"
            style={{ background: "var(--wc-arg)" }}
          />
        </div>
      </div>

      <dl className="mt-3">
        {ROWS.map((row) => {
          const a = row.get(eng);
          const b = row.get(arg);
          const aLead = Number(a) > Number(b);
          const bLead = Number(b) > Number(a);
          return (
            <div
              key={row.label}
              className="flex items-center justify-between border-t py-1.5 text-sm"
              style={{ borderColor: "var(--wc-grid)" }}
            >
              <dd className={`wc-num w-12 ${aLead ? "font-bold" : ""}`} style={{ color: aLead ? "var(--wc-text)" : "var(--wc-text-2)" }}>
                {a}
              </dd>
              <dt className="text-xs" style={{ color: "var(--wc-muted)" }}>
                {row.label}
              </dt>
              <dd className={`wc-num w-12 text-right ${bLead ? "font-bold" : ""}`} style={{ color: bLead ? "var(--wc-text)" : "var(--wc-text-2)" }}>
                {b}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
