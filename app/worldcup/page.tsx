import type { Metadata } from "next";
import WorldCupDashboard from "@/components/worldcup/WorldCupDashboard";
import "./worldcup.css";

export const metadata: Metadata = {
  title: "England vs Argentina — Live World Cup Market",
  description:
    "Polymarket-style live tracker for the FIFA World Cup 2026 semi-final: live pitch view, win-probability chart and event-by-event commentary.",
};

export default function WorldCupPage() {
  return <WorldCupDashboard />;
}
