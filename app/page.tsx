import type { Metadata } from "next";
import { MapPageClient } from "@/components/map/MapPageClient";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return <MapPageClient />;
}
