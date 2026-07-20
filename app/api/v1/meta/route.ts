import { ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";
import { allAdapters } from "@/lib/sources/adapters";

export function GET() {
  const store = getStore();
  return ok({
    lastUpdated: store.builtAt,
    dataMode: store.dataMode,
    counts: {
      incidents: store.incidents.length,
      newsClusters: store.newsClusters.length,
      addresses: store.addresses.length,
      briefings: store.briefings.length,
    },
    adapters: allAdapters.map((a) => ({
      id: a.id,
      ...a.describe(),
      availability: a.availability(),
    })),
  });
}
