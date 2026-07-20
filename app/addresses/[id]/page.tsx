import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressStateChip } from "@/components/addresses/AddressStateChip";
import { AddressActions } from "@/components/addresses/AddressActions";
import { getStore } from "@/lib/domain/store";
import { formatUtc } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const address = getStore().addresses.find((a) => a.id === id);
  return { title: address ? address.title : "Official address" };
}

export default async function AddressPage({ params }: Props) {
  const { id } = await params;
  const store = getStore();
  const address = store.addresses.find((a) => a.id === id);
  if (!address) notFound();

  const cited = address.citedIncidentIds
    .map((cid) => store.incidentsById.get(cid))
    .filter((i) => i !== undefined);

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <Link href="/feed?s=addresses" className="text-sm underline" style={{ color: "var(--accent)" }}>
        ← Official addresses
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <AddressStateChip state={address.state} />
        <span className="chip">{address.countryOrOrg}</span>
        <span className="chip">Original language: {address.originalLanguage.toUpperCase()}</span>
        {address.durationMinutes ? <span className="chip">{address.durationMinutes} min</span> : null}
      </div>

      <h1 className="mt-2 text-xl font-bold leading-snug">{address.title}</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        {address.speaker} — {address.office}, {address.countryOrOrg} · {address.topic}
      </p>
      <p className="mt-2 text-sm">
        <strong>Scheduled:</strong> {formatUtc(address.scheduledAtUtc)}{" "}
        <AddressActions address={address} localTimeOnly />
      </p>

      {/* Player / source access. Streams are never fabricated: without a
          legally embeddable player the app links to the official source. */}
      <div className="card mt-4 p-4">
        {address.state === "live" ? (
          <p className="text-sm">
            <span className="live-dot" aria-hidden="true" /> This briefing is
            listed as live by its official source.
          </p>
        ) : address.state === "replay-available" ? (
          <p className="text-sm">A replay is published by the official source.</p>
        ) : address.state === "upcoming" ? (
          <p className="text-sm">This address has not started yet.</p>
        ) : address.state === "cancelled" ? (
          <p className="text-sm">This event was cancelled by the organizer.</p>
        ) : (
          <p className="text-sm">
            This event has ended{address.state === "replay-unavailable" ? "; no replay was published" : ""}.
          </p>
        )}
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          No embeddable official player is available in demo mode — the app
          never embeds or rehosts media without permission.
        </p>
        <a
          href={address.officialSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chip tap mt-3 inline-flex px-4"
          style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
        >
          Open official source: {address.officialSourceName} ↗
        </a>
      </div>

      <AddressActions address={address} />

      {address.translatedSummary ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Neutral summary
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed">{address.translatedSummary}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            Summary of the speaker&apos;s statements — independent verification is
            tracked separately on linked incidents.
          </p>
        </section>
      ) : null}

      {address.keyAnnouncements.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Key announcements (speaker&apos;s statements)
          </h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {address.keyAnnouncements.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {address.transcript && address.transcript.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Transcript (timestamped)
          </h2>
          <ol className="mt-1.5 space-y-2">
            {address.transcript.map((seg) => (
              <li key={seg.atSeconds} className="card p-2.5 text-sm">
                <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  {Math.floor(seg.atSeconds / 60)}:{String(seg.atSeconds % 60).padStart(2, "0")}
                </span>{" "}
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {seg.speaker}:
                </span>{" "}
                {seg.text}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {cited.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Cited incidents (independently tracked)
          </h2>
          <ul className="mt-1.5 space-y-1.5">
            {cited.map((i) => (
              <li key={i.id}>
                <Link href={`/incident/${i.id}`} className="card block p-2.5 text-sm">
                  <span className="font-semibold">{i.headline}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                    {i.verification} · {i.confidence.band} confidence
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
