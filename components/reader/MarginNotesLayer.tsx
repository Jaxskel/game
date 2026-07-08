"use client";

import { useMemo } from "react";
import type { PageViewport } from "pdfjs-dist";
import { CATEGORIES } from "@/lib/categories";
import type { PlacedAnnotation } from "@/lib/types";
import { toCss } from "./HighlightLayer";

const NOTE_W = 150;
const NOTE_GAP = 8;
const EST_LINE = 15;

/** Darken the pastel highlight color so the label text stays readable. */
function labelColor(category: keyof typeof CATEGORIES): string {
  const [r, g, b] = CATEGORIES[category].rgb;
  return `rgb(${Math.round(r * 160)}, ${Math.round(g * 160)}, ${Math.round(b * 160)})`;
}

/**
 * Margin notes stacked in the gutter at (roughly) the height of their
 * highlight, with SVG leader lines pointing at the highlighted words.
 */
export default function MarginNotesLayer({
  placed,
  viewport,
  gutterLeft, // CSS x where the notes column starts
  totalWidth, // CSS width of the full overlay (page + external gutter, if any)
}: {
  placed: PlacedAnnotation[];
  viewport: PageViewport;
  gutterLeft: number;
  totalWidth: number;
}) {
  const notes = useMemo(() => {
    const entries = placed
      .map((ann) => {
        const anchor = ann.rects[0] ? toCss(viewport, ann.rects[0]) : null;
        return { ann, anchor, y: anchor ? anchor.top - 2 : 40 };
      })
      .sort((a, b) => a.y - b.y);
    // Push overlapping notes down (labels add one extra line of height).
    let cursor = 8;
    for (const e of entries) {
      e.y = Math.max(e.y, cursor);
      const lines = Math.ceil((e.ann.margin_note.length / 22) as number) || 1;
      cursor = e.y + lines * EST_LINE + 12 + 14 + NOTE_GAP;
    }
    return entries;
  }, [placed, viewport]);

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0"
      style={{ width: totalWidth }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden
        style={{ overflow: "visible" }}
      >
        {notes.map(({ ann, anchor, y }, i) =>
          anchor ? (
            <line
              key={i}
              x1={gutterLeft - 4}
              y1={y + 8}
              x2={anchor.left + anchor.width}
              y2={anchor.top + anchor.height / 2}
              stroke={CATEGORIES[ann.category].color}
              strokeWidth={1.5}
              opacity={0.85}
            />
          ) : null,
        )}
      </svg>
      {notes.map(({ ann, y }, i) => (
        <div
          key={i}
          data-testid="margin-note"
          className="absolute rounded-md bg-white/85 pl-2 text-[13px] font-semibold leading-[15px] text-stone-800"
          style={{
            top: y,
            left: gutterLeft,
            width: Math.min(NOTE_W, totalWidth - gutterLeft - 4),
            borderLeft: `4px solid ${CATEGORIES[ann.category].color}`,
          }}
        >
          <span
            className="block text-[9px] font-bold uppercase tracking-wide"
            style={{ color: labelColor(ann.category) }}
          >
            {CATEGORIES[ann.category].label}
          </span>
          {ann.margin_note}
          {ann.rects.length === 0 && (
            <span className="block text-[10px] font-normal text-stone-500">
              near: “{ann.exact_quote.split(" ").slice(0, 5).join(" ")}…”
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
