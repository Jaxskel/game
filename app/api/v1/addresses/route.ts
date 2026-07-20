import { ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";

export function GET() {
  const store = getStore();
  const items = [...store.addresses].sort((a, b) =>
    b.scheduledAtUtc.localeCompare(a.scheduledAtUtc),
  );
  return ok({ items, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
