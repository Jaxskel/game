import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefingTools } from "@/components/briefings/BriefingTools";
import { getStore, type PublicArticleRef } from "@/lib/domain/store";
import type { BriefingClaim } from "@/lib/domain/types";
import { formatUtc } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const briefing = getStore().briefings.find((b) => b.id === id);
  return { title: briefing ? briefing.title : "Briefing" };
}

function Claims({
  title,
  claims,
  refs,
}: {
  title: string;
  claims: BriefingClaim[];
  refs: Map<string, PublicArticleRef>;
}) {
  if (claims.length === 0) return null;
  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      <ul className="mt-1.5 space-y-2">
        {claims.map((c) => (
          <li key={c.text} className="card p-3 text-sm leading-relaxed">
            {c.text}
            {c.sourceArticleIds.length > 0 ? (
              <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
                Sources:{" "}
                {c.sourceArticleIds.map((aid, idx) => {
                  const ref = refs.get(aid);
                  if (!ref) return null;
                  return (
                    <span key={aid}>
                      {idx > 0 ? "; " : ""}
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: "var(--accent)" }}
                      >
                        {ref.publisher}
                      </a>
                    </span>
                  );
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BriefingPage({ params }: Props) {
  const { id } = await params;
  const store = getStore();
  const briefing = store.briefings.find((b) => b.id === id);
  if (!briefing) notFound();

  const majorIncidents = briefing.majorIncidentIds
    .map((iid) => store.incidentsById.get(iid))
    .filter((i) => i !== undefined);

  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <Link href="/briefings" className="text-sm underline" style={{ color: "var(--accent)" }}>
        ← Briefings
      </Link>
      <h1 className="mt-3 text-xl font-bold">
        {briefing.title}
        {briefing.region ? ` — ${briefing.region}` : ""}
      </h1>
      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
        Coverage {formatUtc(briefing.coverageWindowStart)} → {formatUtc(briefing.coverageWindowEnd)} ·
        Published {formatUtc(briefing.publishedAt)}
        {briefing.updatedAt !== briefing.publishedAt
          ? ` · Updated ${formatUtc(briefing.updatedAt)}`
          : ""}
      </p>
      <p className="mt-1 text-xs font-semibold" style={{ color: "var(--warn)" }}>
        ✳ {briefing.authoringMethod}
      </p>

      <section className="card mt-4 p-4">
        <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          60-second summary
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed">{briefing.summary60s}</p>
        <BriefingTools text={briefing.summary60s} briefingId={briefing.id} />
      </section>

      <Claims title="Top developments" claims={briefing.topDevelopments} refs={store.articleRefs} />
      <Claims title="What changed since the prior briefing" claims={briefing.changedSincePrior} refs={store.articleRefs} />

      {majorIncidents.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Major reported incidents
          </h2>
          <ul className="mt-1.5 space-y-1.5">
            {majorIncidents.map((i) => (
              <li key={i.id}>
                <Link href={`/incident/${i.id}`} className="card block p-2.5 text-sm">
                  <span className="font-semibold">{i.headline}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--muted)" }}>
                    {i.location.name} · {i.verification} · {i.confidence.band} confidence
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Claims title="Diplomatic & ceasefire developments" claims={briefing.diplomaticDevelopments} refs={store.articleRefs} />
      <Claims title="Humanitarian impact" claims={briefing.humanitarianImpact} refs={store.articleRefs} />
      <Claims title="Conflicting reports & remaining uncertainty" claims={briefing.conflictingReports} refs={store.articleRefs} />
      <Claims title="What to watch (publicly scheduled)" claims={briefing.whatToWatch} refs={store.articleRefs} />

      {briefing.corrections.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Correction history
          </h2>
          <ul className="mt-1.5 space-y-1.5 text-sm">
            {briefing.corrections.map((c) => (
              <li key={c.at} className="card p-2.5" style={{ borderColor: "var(--accent)" }}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {formatUtc(c.at)} —{" "}
                </span>
                {c.summary}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
