import type { Metadata } from "next";
import { WatchlistScreen } from "@/components/watchlist/WatchlistScreen";
import { getStore } from "@/lib/domain/store";

export const metadata: Metadata = { title: "Watchlist" };

export default function WatchlistPage() {
  const store = getStore();
  return (
    <WatchlistScreen
      countries={store.countries.map((c) => ({ code: c.code, name: c.name }))}
      regions={[...new Set(store.countries.map((c) => c.region))]}
      conflicts={store.conflicts.map((c) => ({ id: c.id, name: c.name }))}
      channels={[...new Set(store.addresses.map((a) => a.countryOrOrg))]}
    />
  );
}
