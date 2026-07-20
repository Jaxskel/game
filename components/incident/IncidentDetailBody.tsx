"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_META } from "@/lib/categories";
import type { PublicIncidentProjection } from "@/lib/domain/projection";
import {
  formatInZone,
  formatUtc,
  relativeTime,
  reportLagQualifier,
  timePrecisionLabel,
} from "@/lib/format";
import { prefs } from "@/lib/client/prefs";
import { LabelRow } from "@/components/Labels";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </h3>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <p style={{ color: "var(--muted)" }}>None reported.</p>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Full incident detail: separate sections for confirmed facts, attributed
 * claims, disputed points, and unknowns; every supporting source with the
 * claim it backs; timeline metadata behind an expandable section.
 */
export function IncidentDetailBody({
  incident,
  onError,
}: {
  incident: PublicIncidentProjection;
  onError?: () => void;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [saved, setSaved] = useState(() => prefs.getSavedIncidents().includes(incident.id));
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const meta = CATEGORY_META[incident.category];
  const lag = reportLagQualifier(incident.eventTime, incident.firstReportedAt);

  async function share() {
    const url = `${window.location.origin}/incident/${incident.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: incident.headline, url });
        return;
      }
    } catch {
      /* user cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
        <span
          className="chip"
          style={{ background: meta.color, color: "#fff", borderColor: meta.color }}
        >
          {meta.code} {meta.label}
        </span>
        <span>{incident.location.name}</span>
        <span aria-hidden="true">·</span>
        <span>
          {formatInZone(incident.eventTime, incident.eventTimezone)}
          {lag ? ` (${lag})` : ""}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed">{incident.summary}</p>

      <div className="mt-3">
        <LabelRow
          verification={incident.verification}
          maturity={incident.maturity}
          dispute={incident.dispute}
          lifecycle={incident.lifecycle}
          provenance={incident.provenance}
          confidence={incident.confidence}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        {incident.confidence.rationale}
      </p>

      {incident.lifecycle === "retracted" && incident.corrections.length > 0 ? (
        <div
          className="card mt-3 p-3 text-sm"
          role="alert"
          style={{ borderColor: "var(--danger)" }}
        >
          <strong>Retracted.</strong> {incident.corrections[incident.corrections.length - 1].summary}
        </div>
      ) : null}

      <Section title="Location">
        <p>
          {incident.location.name} — shown at{" "}
          <strong>{incident.location.precision.replace("-", " ")}</strong> precision with a{" "}
          <strong>{incident.location.uncertaintyKm} km</strong> public uncertainty radius.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          {incident.location.explanation}
        </p>
      </Section>

      <Section title="Confirmed facts">
        <Bullets items={incident.confirmedFacts} />
      </Section>
      <Section title="Attributed claims">
        <Bullets items={incident.attributedClaims} />
      </Section>
      <Section title="Disputed points">
        <Bullets items={incident.disputedPoints} />
      </Section>
      <Section title="Unknowns">
        <Bullets items={incident.unknowns} />
      </Section>

      {incident.casualtyEstimates.length > 0 ? (
        <Section title="Casualty & damage estimates (source-attributed)">
          <ul className="space-y-2">
            {incident.casualtyEstimates.map((e) => (
              <li key={e.attributedTo} className="card p-2.5 text-sm">
                <span className="font-semibold">{e.attributedTo}:</span> {e.text}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title={`Sources (${incident.independentSourceCount} independent)`}>
        <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>
          Independent count excludes syndicated copies, aggregator records, and
          repeat coverage from the same publisher.
        </p>
        <ul className="space-y-2">
          {incident.sources.map((s) => (
            <li key={s.url} className="card p-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-1">
                <span className="font-semibold">{s.publisher}</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {s.sourceType.replace(/-/g, " ")} · {formatUtc(s.publishedAt)}
                </span>
              </div>
              <p className="mt-1">{s.supportsClaim}</p>
              {s.excerpt ? (
                <blockquote
                  className="mt-1 border-l-2 pl-2 text-xs italic"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  “{s.excerpt}”
                </blockquote>
              ) : null}
              <a
                className="mt-1 inline-block text-xs underline"
                style={{ color: "var(--accent)" }}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Original source ↗
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Event timeline & metadata">
        <button
          type="button"
          className="tap card w-full justify-between px-3 text-sm"
          aria-expanded={timelineOpen}
          onClick={() => setTimelineOpen((v) => !v)}
        >
          <span>
            {formatInZone(incident.eventTime, incident.eventTimezone)}{" "}
            {lag ? <em style={{ color: "var(--muted)" }}>({lag})</em> : null}
          </span>
          <span aria-hidden="true">{timelineOpen ? "▲" : "▼"}</span>
        </button>
        {timelineOpen ? (
          <dl className="card mt-2 grid grid-cols-1 gap-2 p-3 text-xs sm:grid-cols-2">
            <div>
              <dt style={{ color: "var(--muted)" }}>Occurrence precision</dt>
              <dd>{timePrecisionLabel(incident.eventTimePrecision)}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)" }}>Event time (UTC)</dt>
              <dd>{formatUtc(incident.eventTime)}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)" }}>First seen</dt>
              <dd>{formatUtc(incident.firstReportedAt)}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)" }}>Published</dt>
              <dd>{formatUtc(incident.publishedAt)}</dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)" }}>Last revised</dt>
              <dd>
                {formatUtc(incident.updatedAt)} ({relativeTime(incident.updatedAt)})
              </dd>
            </div>
          </dl>
        ) : null}
      </Section>

      {incident.updatesLog.length > 0 ? (
        <Section title="Update log">
          <ol className="space-y-1.5 text-sm">
            {incident.updatesLog.map((u) => (
              <li key={u.at}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {formatUtc(u.at)} —{" "}
                </span>
                {u.text}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {incident.corrections.length > 0 && incident.lifecycle !== "retracted" ? (
        <Section title="Corrections">
          <ul className="space-y-1.5 text-sm">
            {incident.corrections.map((c) => (
              <li key={c.at} className="card p-2.5" style={{ borderColor: "var(--accent)" }}>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {formatUtc(c.at)} —{" "}
                </span>
                {c.summary}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {incident.relatedIncidentIds.length > 0 ? (
        <Section title="Related">
          <ul className="space-y-1">
            {incident.relatedIncidentIds.map((id) => (
              <li key={id}>
                <Link className="text-sm underline" style={{ color: "var(--accent)" }} href={`/incident/${id}`}>
                  {id.replace(/^inc-/, "").replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
          {incident.briefingId ? (
            <p className="mt-2 text-sm">
              <Link className="underline" style={{ color: "var(--accent)" }} href={`/briefings/${incident.briefingId}`}>
                Read the applicable briefing →
              </Link>
            </p>
          ) : null}
        </Section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="tap chip px-4"
          aria-pressed={saved}
          onClick={() => setSaved(prefs.toggleSavedIncident(incident.id).includes(incident.id))}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
        <button type="button" className="tap chip px-4" onClick={share}>
          {shareState === "copied" ? "✓ Link copied" : "↗ Share"}
        </button>
        <button
          type="button"
          className="tap chip px-4"
          onClick={() =>
            onError
              ? onError()
              : window.alert(
                  "Thanks — error reports go to the editorial desk. (Demo: not transmitted.)",
                )
          }
        >
          ⚑ Report an error
        </button>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
        Demo data — fictional scenario. Locations are generalized; exact
        coordinates are never published for active events.
      </p>
    </div>
  );
}
