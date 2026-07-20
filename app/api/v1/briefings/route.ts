import { ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";

export function GET() {
  const store = getStore();
  const items = [...store.briefings].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  return ok({ items, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
