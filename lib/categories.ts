import type { IncidentCategory } from "@/lib/domain/types";

/**
 * Category presentation. Every category has a distinct two-letter code and
 * label so meaning never depends on color alone (WCAG 1.4.1).
 */
export interface CategoryMeta {
  label: string;
  code: string;
  color: string;
  kinetic: boolean;
}

export const CATEGORY_META: Record<IncidentCategory, CategoryMeta> = {
  "air-missile-strike": { label: "Air / missile strike", code: "AS", color: "#c2410c", kinetic: true },
  "drone-event": { label: "Drone event", code: "DR", color: "#b45309", kinetic: true },
  "ground-fighting": { label: "Ground fighting", code: "GF", color: "#a16207", kinetic: true },
  "naval-incident": { label: "Naval incident", code: "NV", color: "#0e7490", kinetic: true },
  explosion: { label: "Explosion", code: "EX", color: "#be123c", kinetic: true },
  interception: { label: "Interception", code: "IC", color: "#7c3aed", kinetic: true },
  "civil-unrest": { label: "Civil unrest", code: "CU", color: "#a21caf", kinetic: false },
  "cyber-incident": { label: "Cyber incident", code: "CY", color: "#4f46e5", kinetic: false },
  "ceasefire-negotiation": { label: "Ceasefire / negotiation", code: "CF", color: "#047857", kinetic: false },
  "sanctions-diplomacy": { label: "Sanctions / diplomacy", code: "DP", color: "#0369a1", kinetic: false },
  "humanitarian-emergency": { label: "Humanitarian emergency", code: "HM", color: "#15803d", kinetic: false },
  "official-address": { label: "Official address", code: "OF", color: "#475569", kinetic: false },
};
