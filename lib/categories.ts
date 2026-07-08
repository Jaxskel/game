import type { CategoryKey } from "./types";

/** Single source of truth for annotation categories: labels + highlighter colors. */
export const CATEGORIES: Record<
  CategoryKey,
  { label: string; color: string; rgb: [number, number, number] }
> = {
  setting: { label: "Setting", color: "#4ade80", rgb: [0.29, 0.87, 0.5] },
  character: { label: "Character", color: "#fde047", rgb: [0.99, 0.88, 0.28] },
  figurative_language: {
    label: "Figurative language",
    color: "#f9a8d4",
    rgb: [0.98, 0.66, 0.83],
  },
  conflict_event: {
    label: "Conflict / key event",
    color: "#fb923c",
    rgb: [0.98, 0.57, 0.24],
  },
  theme: { label: "Theme", color: "#93c5fd", rgb: [0.58, 0.77, 0.99] },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];
