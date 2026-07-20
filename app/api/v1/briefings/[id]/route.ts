import { err, ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const briefing = store.briefings.find((b) => b.id === id);
  if (!briefing) return err("not_found", "No briefing with this id.", 404);
  return ok({ briefing, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
