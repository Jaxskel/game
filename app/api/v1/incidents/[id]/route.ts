import { err, ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const incident = store.incidentsById.get(id);
  if (!incident) {
    // Withheld/embargoed incidents are indistinguishable from nonexistent ones.
    return err("not_found", "No published incident with this id.", 404);
  }
  return ok({ incident, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
