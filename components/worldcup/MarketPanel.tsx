"use client";

import { MATCH_INFO } from "@/lib/worldcup/data";
import { toCents } from "@/lib/worldcup/prob";
import type { MatchState } from "@/lib/worldcup/types";

const OUTCOMES = [
  { key: "eng", name: "England", color: "var(--wc-eng)" },
  { key: "draw", name: "Draw", color: "var(--wc-draw)" },
  { key: "arg", name: "Argentina", color: "var(--wc-arg)" },
] as const;

export default function MarketPanel({ state }: { state: MatchState }) {
  const cents = toCents(state.probs);
  const settled = state.phase === "ft";

  return (
    <section className="wc-card p-4" aria-label="Market outcomes">
      <h2 className="text-sm font-semibold" style={{ color: "var(--wc-text-2)" }}>
        {MATCH_INFO.marketQuestion}
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--wc-muted)" }}>
        {settled
          ? "Market resolved at full-time."
          : state.oddsSource === "polymarket"
            ? "Live Polymarket prices · display only"
            : state.mode === "real"
              ? "Model odds from the live score · display only"
              : "Prices track the live model · demo only"}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {OUTCOMES.map((o) => {
          const pct = state.probs[o.key];
          const price = cents[o.key];
          const won = settled && pct > 50;
          return (
            <div
              key={o.key}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{
                borderColor: won ? o.color : "var(--wc-border)",
                background: "var(--wc-surface-2)",
              }}
            >
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: o.color }} />
              <span className="text-sm font-medium">{o.name}</span>
              <span className="wc-num ml-auto text-sm font-bold">
                {settled ? (won ? "✓ 100¢" : "0¢") : `${pct.toFixed(1)}%`}
              </span>
              {!settled && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="wc-num rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ background: "color-mix(in srgb, var(--wc-good) 18%, transparent)", color: "var(--wc-good)" }}
                    title="Demo market — no real orders are placed"
                  >
                    Yes {price}¢
                  </button>
                  <button
                    type="button"
                    className="wc-num rounded-md px-2 py-1 text-xs font-semibold"
                    style={{ background: "color-mix(in srgb, var(--wc-bad) 18%, transparent)", color: "var(--wc-bad)" }}
                    title="Demo market — no real orders are placed"
                  >
                    No {100 - price}¢
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
