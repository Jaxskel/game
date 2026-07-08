"use client";

import { useMemo } from "react";
import type { PageViewport } from "pdfjs-dist";
import { CATEGORIES } from "@/lib/categories";
import type { PlacedAnnotation } from "@/lib/types";
import { toCss } from "./HighlightLayer";

const NOTE_W = 165;
const NOTE_GAP = 14;
const LINE_H = 16; // px per wrapped text line
const LABEL_H = 14;
const PAD_V = 12; // vertical padding of the note card
const CHARS_PER_LINE = 19;

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
    // Push overlapping notes down so cards never collide.
    let cursor = 8;
    for (const e of entries) {
      e.y = Math.max(e.y, cursor);
      const textLines = Math.max(
        1,
        Math.ceil(e.ann.margin_note.length / CHARS_PER_LINE),
      );
      const cardH = LABEL_H + textLines * LINE_H + PAD_V;
      cursor = e.y + cardH + NOTE_GAP;
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
              y1={y + 10}
              x2={anchor.left + anchor.width}
              y2={anchor.top + anchor.height / 2}
              stroke={CATEGORIES[ann.category].color}
              strokeWidth={1.5}
              opacity={0.8}
            />
          ) : null,
        )}
      </svg>
      {notes.map(({ ann, y }, i) => (
        <div
          key={i}
          data-testid="margin-note"
          className="absolute rounded-lg bg-white/95 px-2 py-1.5 text-[13px] font-semibold leading-[16px] text-stone-800 shadow-sm ring-1 ring-stone-200/60"
          style={{
            top: y,
            left: gutterLeft,
            width: Math.min(NOTE_W, totalWidth - gutterLeft - 4),
            borderLeft: `4px solid ${CATEGORIES[ann.category].color}`,
          }}
        >
          <span
            className="mb-0.5 block text-[9px] font-bold uppercase tracking-wide"
            style={{ color: labelColor(ann.category) }}
          >
            {CATEGORIES[ann.category].label}
          </span>
          {ann.margin_note}
          {ann.rects.length === 0 && (
            <span className="mt-0.5 block text-[10px] font-normal leading-[13px] text-stone-500">
              near: “{ann.exact_quote.split(" ").slice(0, 5).join(" ")}…”
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
