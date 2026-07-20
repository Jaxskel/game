import { z } from "zod";
import { ok, parseQuery } from "@/lib/api/respond";
import { getStore, queryIncidents } from "@/lib/domain/store";
import { INCIDENT_CATEGORIES } from "@/lib/domain/types";

const querySchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES).optional(),
  conflictId: z.string().max(64).optional(),
  countryCode: z.string().max(3).optional(),
  verification: z.enum(["unverified", "single-source", "corroborated"]).optional(),
  confidence: z.enum(["low", "moderate", "high"]).optional(),
  sinceHours: z.coerce.number().int().min(1).max(24 * 365).optional(),
  q: z.string().max(200).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export function GET(request: Request) {
  const parsed = parseQuery(request.url, querySchema);
  if (parsed.response) return parsed.response;

  const store = getStore();
  const page = queryIncidents(store, parsed.data);
  return ok({
    ...page,
    lastUpdated: store.builtAt,
    dataMode: store.dataMode,
  });
}
