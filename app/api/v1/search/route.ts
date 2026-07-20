import { z } from "zod";
import { ok, parseQuery } from "@/lib/api/respond";
import { getStore, search } from "@/lib/domain/store";

const querySchema = z.object({
  q: z.string().min(1).max(200),
});

export function GET(request: Request) {
  const parsed = parseQuery(request.url, querySchema);
  if (parsed.response) return parsed.response;

  const store = getStore();
  return ok({
    results: search(store, parsed.data.q),
    lastUpdated: store.builtAt,
    dataMode: store.dataMode,
  });
}
