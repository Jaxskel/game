import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentDetailBody } from "@/components/incident/IncidentDetailBody";
import { getStore } from "@/lib/domain/store";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const incident = getStore().incidentsById.get(id);
  return { title: incident ? incident.headline : "Incident" };
}

/** Standalone, shareable incident route (also the no-JS/list alternative to
 * the map sheet). Serves only the public projection — like everything else. */
export default async function IncidentPage({ params }: Props) {
  const { id } = await params;
  const incident = getStore().incidentsById.get(id);
  if (!incident) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <Link href="/" className="text-sm underline" style={{ color: "var(--accent)" }}>
        ← Map
      </Link>
      <h1 className="mt-3 text-xl font-bold leading-snug">{incident.headline}</h1>
      <div className="mt-3">
        <IncidentDetailBody incident={incident} />
      </div>
    </div>
  );
}
