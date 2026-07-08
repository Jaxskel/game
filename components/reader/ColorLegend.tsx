"use client";

import { CATEGORIES, CATEGORY_KEYS } from "@/lib/categories";

export default function ColorLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-testid="color-legend">
      {CATEGORY_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: CATEGORIES[k].color }}
          />
          {CATEGORIES[k].label}
        </span>
      ))}
    </div>
  );
}
