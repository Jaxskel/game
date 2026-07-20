"use client";

import dynamic from "next/dynamic";
import { OnboardingGate } from "@/components/OnboardingGate";

// MapLibre needs the DOM; load the map screen client-side only, with a
// skeleton while the chunk loads.
const MapScreen = dynamic(
  () => import("./MapScreen").then((m) => m.MapScreen),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
        Loading map…
      </div>
    ),
  },
);

export function MapPageClient() {
  return (
    <>
      <OnboardingGate />
      <MapScreen />
    </>
  );
}
