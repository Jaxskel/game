"use client";

import { useEffect, useRef } from "react";
import { TEAMS } from "@/lib/worldcup/data";
import type { MatchState } from "@/lib/worldcup/types";

/** Standard pitch proportions, 105m × 68m. */
const PW = 105;
const PH = 68;

export default function Pitch({ state }: { state: MatchState }) {
  const ballRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const trailRefs = [useRef<SVGCircleElement>(null), useRef<SVGCircleElement>(null)];
  const target = useRef({ x: 50, y: 50 });
  const pos = useRef({ x: 50, y: 50 });
  const trail = useRef([
    { x: 50, y: 50 },
    { x: 50, y: 50 },
  ]);

  target.current = { x: state.ball.x, y: state.ball.y };

  // 60fps chase of the last received ball position — smooth "live view".
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const step = (t: number) => {
      const dt = Math.min((t - lastT) / 1000, 0.1);
      lastT = t;
      const k = 1 - Math.exp(-dt * 7);
      pos.current.x += (target.current.x - pos.current.x) * k;
      pos.current.y += (target.current.y - pos.current.y) * k;

      const kt = 1 - Math.exp(-dt * 3.5);
      trail.current[0].x += (pos.current.x - trail.current[0].x) * kt;
      trail.current[0].y += (pos.current.y - trail.current[0].y) * kt;
      trail.current[1].x += (trail.current[0].x - trail.current[1].x) * kt;
      trail.current[1].y += (trail.current[0].y - trail.current[1].y) * kt;

      const toPitch = (p: { x: number; y: number }) => ({
        cx: (p.x / 100) * PW,
        cy: (p.y / 100) * PH,
      });
      const b = toPitch(pos.current);
      ballRef.current?.setAttribute("cx", String(b.cx));
      ballRef.current?.setAttribute("cy", String(b.cy));
      ringRef.current?.setAttribute("cx", String(b.cx));
      ringRef.current?.setAttribute("cy", String(b.cy));
      trailRefs.forEach((r, i) => {
        const tp = toPitch(trail.current[i]);
        r.current?.setAttribute("cx", String(tp.cx));
        r.current?.setAttribute("cy", String(tp.cy));
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const possColor = state.possession === "ENG" ? "var(--wc-eng)" : "var(--wc-arg)";

  return (
    <section className="wc-card p-4" aria-label="Live pitch view">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "var(--wc-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--wc-eng)" }} />
          {TEAMS.ENG.short} attack →
        </span>
        <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--wc-text-2)" }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: possColor }} />
          {state.mode === "real"
            ? `Possession lead: ${TEAMS[state.possession].name}`
            : `In possession: ${TEAMS[state.possession].name}`}
        </span>
        <span className="flex items-center gap-1.5">
          ← {TEAMS.ARG.short} attack
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--wc-arg)" }} />
        </span>
      </div>

      <svg
        viewBox={`-2 -2 ${PW + 4} ${PH + 4}`}
        className="mt-2 block w-full rounded-lg"
        role="img"
        aria-label={`Live ball position. ${TEAMS[state.possession].name} in possession.`}
        style={{ background: "var(--wc-pitch)" }}
      >
        {/* Mown stripes */}
        {Array.from({ length: 5 }, (_, i) => (
          <rect key={i} x={(i * 2 + 1) * (PW / 10)} y={0} width={PW / 10} height={PH} fill="var(--wc-pitch-stripe)" />
        ))}

        {/* Markings */}
        <g fill="none" stroke="var(--wc-pitch-line)" strokeWidth={0.5}>
          <rect x={0} y={0} width={PW} height={PH} />
          <line x1={PW / 2} y1={0} x2={PW / 2} y2={PH} />
          <circle cx={PW / 2} cy={PH / 2} r={9.15} />
          {/* Penalty areas & six-yard boxes */}
          <rect x={0} y={13.84} width={16.5} height={40.32} />
          <rect x={PW - 16.5} y={13.84} width={16.5} height={40.32} />
          <rect x={0} y={24.84} width={5.5} height={18.32} />
          <rect x={PW - 5.5} y={24.84} width={5.5} height={18.32} />
          {/* Penalty arcs */}
          <path d="M 16.5 27.09 A 9.15 9.15 0 0 1 16.5 40.91" />
          <path d="M 88.5 27.09 A 9.15 9.15 0 0 0 88.5 40.91" />
          {/* Corner arcs */}
          <path d="M 1 0 A 1 1 0 0 1 0 1" />
          <path d={`M ${PW - 1} 0 A 1 1 0 0 0 ${PW} 1`} />
          <path d={`M 0 ${PH - 1} A 1 1 0 0 1 1 ${PH}`} />
          <path d={`M ${PW} ${PH - 1} A 1 1 0 0 0 ${PW - 1} ${PH}`} />
          {/* Goals */}
          <rect x={-1.5} y={30.34} width={1.5} height={7.32} />
          <rect x={PW} y={30.34} width={1.5} height={7.32} />
        </g>
        {/* Spots */}
        <circle cx={11} cy={PH / 2} r={0.5} fill="var(--wc-pitch-line)" />
        <circle cx={PW - 11} cy={PH / 2} r={0.5} fill="var(--wc-pitch-line)" />
        <circle cx={PW / 2} cy={PH / 2} r={0.5} fill="var(--wc-pitch-line)" />

        {/* Ball trail, possession ring, ball */}
        <circle ref={trailRefs[1]} r={0.7} fill="#ffffff" opacity={0.15} />
        <circle ref={trailRefs[0]} r={0.85} fill="#ffffff" opacity={0.3} />
        <circle ref={ringRef} r={2.3} fill="none" stroke={possColor} strokeWidth={0.55} opacity={0.9} />
        <circle ref={ballRef} r={1.05} fill="#ffffff" stroke="#00000055" strokeWidth={0.2} />
      </svg>
    </section>
  );
}
