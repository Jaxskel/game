import { err, ok } from "@/lib/api/respond";
import { getStore } from "@/lib/domain/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const address = store.addresses.find((a) => a.id === id);
  if (!address) return err("not_found", "No address with this id.", 404);
  return ok({ address, lastUpdated: store.builtAt, dataMode: store.dataMode });
}
