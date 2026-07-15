"use client";

import { useMemo, useRef, useState } from "react";
import type { HistoryPoint, MatchState } from "@/lib/worldcup/types";

const W = 720;
const H = 300;
const PAD = { top: 16, right: 86, bottom: 26, left: 42 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const SERIES = [
  { key: "e", name: "England", short: "ENG", color: "var(--wc-eng)", dash: undefined },
  { key: "a", name: "Argentina", short: "ARG", color: "var(--wc-arg)", dash: undefined },
  { key: "d", name: "Draw", short: "DRAW", color: "var(--wc-draw)", dash: "5 4" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const x = (m: number) => PAD.left + (Math.min(m, 90) / 90) * PW;
const y = (pct: number) => PAD.top + (1 - pct / 100) * PH;

const X_TICKS: { m: number; label: string }[] = [
  { m: 0, label: "KO" },
  { m: 15, label: "15'" },
  { m: 30, label: "30'" },
  { m: 45, label: "HT" },
  { m: 60, label: "60'" },
  { m: 75, label: "75'" },
  { m: 90, label: "FT" },
];

export default function ProbChart({
  history,
  state,
}: {
  history: HistoryPoint[];
  state: MatchState;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HistoryPoint | null>(null);

  const paths = useMemo(() => {
    const build = (key: SeriesKey) =>
      history
        .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.m).toFixed(1)},${y(p[key]).toFixed(1)}`)
        .join("");
    return { e: build("e"), a: build("a"), d: build("d") };
  }, [history]);

  // Goal markers: any point where the score moved vs the previous point.
  const goals = useMemo(() => {
    const out: { m: number; team: "ENG" | "ARG"; score: string }[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const cur = history[i];
      if (cur.ge > prev.ge) out.push({ m: cur.m, team: "ENG", score: `${cur.ge}–${cur.ga}` });
      if (cur.ga > prev.ga) out.push({ m: cur.m, team: "ARG", score: `${cur.ge}–${cur.ga}` });
    }
    return out;
  }, [history]);

  const last = history[history.length - 1];

  // Right-edge direct labels, nudged apart when values collide.
  const endLabels = useMemo(() => {
    if (!last) return [];
    const items = SERIES.map((s) => ({ ...s, value: last[s.key], ly: y(last[s.key]) })).sort(
      (p, q) => p.ly - q.ly,
    );
    for (let i = 1; i < items.length; i++) {
      if (items[i].ly - items[i - 1].ly < 15) items[i].ly = items[i - 1].ly + 15;
    }
    return items;
  }, [last]);

  const onMove = (ev: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg || history.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    const m = ((mx - PAD.left) / PW) * 90;
    let best = history[0];
    for (const p of history) {
      if (Math.abs(p.m - m) < Math.abs(best.m - m)) best = p;
    }
    setHover(best);
  };

  const live = state.probs;

  return (
    <section className="wc-card p-4" aria-label="Live win probability market">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: "var(--wc-text-2)" }}>
          Match odds — live
        </h2>
        <span className="wc-num text-xs" style={{ color: "var(--wc-muted)" }}>
          ${state.volume.toLocaleString("en-US")} Vol.
        </span>
      </div>

      {/* Legend doubles as the live read-out (direct labels, not color-alone). */}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        {SERIES.map((s) => {
          const value = s.key === "e" ? live.eng : s.key === "a" ? live.arg : live.draw;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-sm" style={{ color: "var(--wc-text-2)" }}>
                {s.name}
              </span>
              <span className="wc-num text-lg font-bold">{value.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      <div className="relative mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label="Win probability over match time for England, Argentina and the draw"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* Gridlines + y labels */}
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 0 ? "var(--wc-axis)" : "var(--wc-grid)"}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 3.5}
                textAnchor="end"
                fontSize={12.5}
                className="wc-num"
                fill="var(--wc-muted)"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* X ticks */}
          {X_TICKS.map((t) => (
            <text
              key={t.m}
              x={x(t.m)}
              y={H - 8}
              textAnchor="middle"
              fontSize={12.5}
              className="wc-num"
              fill="var(--wc-muted)"
            >
              {t.label}
            </text>
          ))}

          {/* Goal markers */}
          {goals.map((g, i) => (
            <g key={i}>
              <line
                x1={x(g.m)}
                x2={x(g.m)}
                y1={PAD.top}
                y2={PAD.top + PH}
                stroke={g.team === "ENG" ? "var(--wc-eng)" : "var(--wc-arg)"}
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={0.7}
              />
              <text x={x(g.m)} y={PAD.top - 4} textAnchor="middle" fontSize={12.5}>
                ⚽
              </text>
            </g>
          ))}

          {/* Series lines */}
          {SERIES.map((s) => (
            <path
              key={s.key}
              d={paths[s.key]}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* Line-end dots + direct labels */}
          {last &&
            endLabels.map((s) => (
              <g key={s.key}>
                <circle cx={x(last.m)} cy={y(s.value)} r={3.5} fill={s.color} />
                <circle cx={x(last.m) + 12} cy={s.ly - 3.5} r={3} fill={s.color} />
                <text
                  x={x(last.m) + 19}
                  y={s.ly}
                  fontSize={12.5}
                  fontWeight={600}
                  className="wc-num"
                  fill="var(--wc-text-2)"
                >
                  {s.short} {s.value.toFixed(0)}%
                </text>
              </g>
            ))}

          {/* Hover crosshair */}
          {hover && (
            <g>
              <line
                x1={x(hover.m)}
                x2={x(hover.m)}
                y1={PAD.top}
                y2={PAD.top + PH}
                stroke="var(--wc-axis)"
                strokeWidth={1}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover.m)}
                  cy={y(hover[s.key])}
                  r={4}
                  fill={s.color}
                  stroke="var(--wc-surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-xs shadow-lg"
            style={{
              background: "var(--wc-surface-2)",
              borderColor: "var(--wc-border)",
              left: `${Math.min(Math.max((x(hover.m) / W) * 100, 8), 74)}%`,
            }}
          >
            <div className="wc-num font-semibold" style={{ color: "var(--wc-text-2)" }}>
              {Math.round(hover.m)}&apos; · ENG {hover.ge}–{hover.ga} ARG
            </div>
            {[...SERIES]
              .sort((p, q) => hover[q.key] - hover[p.key])
              .map((s) => (
                <div key={s.key} className="mt-1 flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span style={{ color: "var(--wc-text-2)" }}>{s.name}</span>
                  <span className="wc-num ml-auto pl-3 font-bold">{hover[s.key].toFixed(1)}%</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Screen-reader table view of the live market */}
      <table className="sr-only">
        <caption>Live match-odds probabilities</caption>
        <thead>
          <tr>
            <th>Outcome</th>
            <th>Probability</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>England</td>
            <td>{live.eng.toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Draw</td>
            <td>{live.draw.toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Argentina</td>
            <td>{live.arg.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
