import { z } from "zod";
import { ok, parseQuery } from "@/lib/api/respond";
import { getStore, queryNews } from "@/lib/domain/store";

const querySchema = z.object({
  tab: z.enum(["all", "breaking", "diplomacy", "humanitarian", "official"]).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(["latest", "significance"]).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function GET(request: Request) {
  const parsed = parseQuery(request.url, querySchema);
  if (parsed.response) return parsed.response;

  const store = getStore();
  const page = queryNews(store, parsed.data);
  return ok({ ...page, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
