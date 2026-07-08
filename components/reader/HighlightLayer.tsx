"use client";

import type { PageViewport } from "pdfjs-dist";
import { CATEGORIES } from "@/lib/categories";
import type { PlacedAnnotation } from "@/lib/types";

/** Convert a PDF-space rect to CSS px within the rendered page. */
export function toCss(
  viewport: PageViewport,
  r: { x: number; y: number; w: number; h: number },
) {
  const [x1, y1] = viewport.convertToViewportPoint(r.x, r.y) as number[];
  const [x2, y2] = viewport.convertToViewportPoint(r.x + r.w, r.y + r.h) as number[];
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export default function HighlightLayer({
  placed,
  viewport,
}: {
  placed: PlacedAnnotation[];
  viewport: PageViewport;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {placed.flatMap((ann, i) =>
        ann.rects.map((r, j) => {
          const css = toCss(viewport, r);
          return (
            <div
              key={`${i}-${j}`}
              data-testid="highlight-rect"
              data-category={ann.category}
              className="absolute rounded-[2px]"
              style={{
                ...css,
                backgroundColor: CATEGORIES[ann.category].color,
                opacity: 0.45,
                mixBlendMode: "multiply",
              }}
            />
          );
        }),
      )}
    </div>
  );
}
