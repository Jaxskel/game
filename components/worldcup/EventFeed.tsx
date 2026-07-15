"use client";

import type { EventType, MatchEvent } from "@/lib/worldcup/types";

const BADGES: Partial<Record<EventType, { label: string; bg?: string; fg?: string }>> = {
  goal: { label: "GOAL" },
  disallowed: { label: "NO GOAL", bg: "var(--wc-bad)", fg: "#fff" },
  var: { label: "VAR", bg: "var(--wc-surface-2)" },
  offside: { label: "OFFSIDE" },
  save: { label: "SAVE" },
  shot_off_target: { label: "SHOT" },
  shot_blocked: { label: "BLOCK" },
  big_chance: { label: "CHANCE" },
  corner: { label: "CORNER" },
  foul: { label: "FOUL" },
  yellow: { label: "YC", bg: "#fab219", fg: "#0b0b0b" },
  red: { label: "RC", bg: "var(--wc-bad)", fg: "#fff" },
  sub: { label: "SUB" },
  kickoff: { label: "KO" },
  half_time: { label: "HT" },
  second_half: { label: "2H" },
  full_time: { label: "FT" },
  info: { label: "INFO" },
};

function teamColor(ev: MatchEvent): string | undefined {
  if (!ev.team) return undefined;
  return ev.team === "ENG" ? "var(--wc-eng)" : "var(--wc-arg)";
}

export default function EventFeed({ events }: { events: MatchEvent[] }) {
  return (
    <section className="wc-card p-4" aria-label="Live commentary">
      <h2 className="text-sm font-semibold" style={{ color: "var(--wc-text-2)" }}>
        Live commentary
      </h2>
      <ol className="mt-2 flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1" aria-live="polite">
        {events.map((ev) => {
          const badge = BADGES[ev.type] ?? { label: "•" };
          const color = teamColor(ev);
          const isGoal = ev.type === "goal";
          return (
            <li
              key={ev.id}
              className="wc-feed-item flex items-start gap-2 rounded-md border-l-2 py-1.5 pl-2 text-sm"
              style={{
                borderColor: color ?? "transparent",
                background: isGoal ? "color-mix(in srgb, " + color + " 12%, transparent)" : undefined,
              }}
            >
              <span className="wc-num mt-0.5 w-10 shrink-0 text-xs" style={{ color: "var(--wc-muted)" }}>
                {ev.clock}
              </span>
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                style={{
                  background: badge.bg ?? (color ? `color-mix(in srgb, ${color} 22%, transparent)` : "var(--wc-surface-2)"),
                  color: badge.fg ?? color ?? "var(--wc-muted)",
                }}
              >
                {badge.label}
              </span>
              <span style={{ color: isGoal ? "var(--wc-text)" : "var(--wc-text-2)", fontWeight: isGoal ? 600 : 400 }}>
                {ev.text}
              </span>
            </li>
          );
        })}
        {events.length === 0 && (
          <li className="text-xs" style={{ color: "var(--wc-muted)" }}>
            Waiting for kick-off…
          </li>
        )}
      </ol>
    </section>
  );
}
