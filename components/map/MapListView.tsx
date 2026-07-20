"use client";

import { CATEGORY_META } from "@/lib/categories";
import type { PublicIncidentProjection } from "@/lib/domain/projection";
import { formatInZone, relativeTime } from "@/lib/format";
import { LabelRow } from "@/components/Labels";

/**
 * Complete structured list alternative to the map: every result visible on
 * the map is in this list (accessibility requirement and low-power fallback).
 */
export function MapListView({
  incidents,
  onSelect,
  emptyHint,
}: {
  incidents: PublicIncidentProjection[];
  onSelect: (id: string) => void;
  emptyHint?: string;
}) {
  if (incidents.length === 0) {
    return (
      <p className="p-6 text-center text-sm" style={{ color: "var(--muted)" }}>
        {emptyHint ?? "No incidents match the current filters."}
      </p>
    );
  }
  return (
    <ul className="space-y-2 p-3" aria-label="Incident list">
      {incidents.map((incident) => {
        const meta = CATEGORY_META[incident.category];
        return (
          <li key={incident.id}>
            <button
              type="button"
              className="card block w-full p-3 text-left"
              onClick={() => onSelect(incident.id)}
            >
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="gcm-marker shrink-0"
                  style={{ background: meta.color, width: 30, height: 30, fontSize: 10 }}
                >
                  {meta.code}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-snug">{incident.headline}</h3>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {meta.label} · {incident.location.name} ·{" "}
                    {formatInZone(incident.eventTime, incident.eventTimezone)} (
                    {relativeTime(incident.eventTime)})
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <LabelRow
                  verification={incident.verification}
                  maturity={incident.maturity}
                  dispute={incident.dispute}
                  lifecycle={incident.lifecycle}
                  confidence={incident.confidence}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
