import {
  KINETIC_CATEGORIES,
  type Incident,
  type PublicLocation,
} from "./types";

/**
 * Server-side safety gate. Publication requires ALL of:
 *  1. an approved public source has reported the incident (fixtures satisfy
 *     this by construction; live ingestion enforces it upstream),
 *  2. the safety embargo has elapsed (default >= 60 min after first report),
 *  3. the risk gate is not withholding it (embargo expiry is necessary,
 *     never sufficient),
 *  4. lifecycle is a public state (not draft).
 *
 * Retracted incidents remain visible WITH their retraction notice — hiding
 * them would erase the correction record.
 */

export const MIN_KINETIC_DELAY_MINUTES = 60;

/** Minimum public uncertainty radius for kinetic incidents, by precision. */
const MIN_KINETIC_UNCERTAINTY_KM = 10;

/** Coordinates are rounded so a marker can never imply pinpoint accuracy.
 * 1 decimal place ≈ 11 km at the equator. */
export const COORD_DECIMALS = 1;

export function roundCoord(value: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(value * f) / f;
}

export interface GateDecision {
  publishable: boolean;
  reason?: string;
}

export function gateIncident(incident: Incident, now: Date): GateDecision {
  if (incident.lifecycle === "draft") {
    return { publishable: false, reason: "draft" };
  }
  if (incident.riskWithheld) {
    return {
      publishable: false,
      reason: incident.riskWithheldReason ?? "withheld by risk gate",
    };
  }
  const notBefore = new Date(incident.embargo.publishNotBefore);
  if (now < notBefore) {
    return { publishable: false, reason: "safety embargo active" };
  }
  if (KINETIC_CATEGORIES.has(incident.category)) {
    const firstReported = new Date(incident.firstReportedAt);
    const minutesSince = (now.getTime() - firstReported.getTime()) / 60_000;
    if (minutesSince < MIN_KINETIC_DELAY_MINUTES) {
      return { publishable: false, reason: "minimum kinetic delay not met" };
    }
  }
  return { publishable: true };
}

/**
 * Generalize a location for public display: round coordinates and enforce a
 * minimum uncertainty radius for kinetic incidents. Never returns more
 * precision than the stored (already coarse) geometry.
 */
export function generalizeLocation(
  location: PublicLocation,
  isKinetic: boolean,
): PublicLocation {
  return {
    ...location,
    lat: roundCoord(location.lat),
    lon: roundCoord(location.lon),
    uncertaintyKm: isKinetic
      ? Math.max(location.uncertaintyKm, MIN_KINETIC_UNCERTAINTY_KM)
      : location.uncertaintyKm,
  };
}
