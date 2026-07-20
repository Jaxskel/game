import type {
  Confidence,
  DisputeState,
  Lifecycle,
  Maturity,
  Provenance,
  Verification,
} from "@/lib/domain/types";

/**
 * Editorial-axis labels. Each label pairs an explicit text with a distinct
 * glyph so meaning never relies on color alone. The axes stay separate —
 * there is deliberately no combined "truth score" badge.
 */

function Chip({
  children,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  title?: string;
}) {
  const toneStyle: Record<string, React.CSSProperties> = {
    neutral: {},
    good: { borderColor: "var(--ok)", color: "var(--ok)" },
    warn: { borderColor: "var(--warn)", color: "var(--warn)" },
    bad: { borderColor: "var(--danger)", color: "var(--danger)" },
    info: { borderColor: "var(--accent)", color: "var(--accent)" },
  };
  return (
    <span className="chip" style={toneStyle[tone]} title={title}>
      {children}
    </span>
  );
}

export function VerificationChip({ value }: { value: Verification }) {
  switch (value) {
    case "corroborated":
      return <Chip tone="good">✓✓ Corroborated</Chip>;
    case "single-source":
      return <Chip tone="warn">✓ Single-source</Chip>;
    default:
      return <Chip tone="bad">? Unverified</Chip>;
  }
}

export function MaturityChip({ value }: { value: Maturity }) {
  return value === "developing" ? (
    <Chip tone="warn">◌ Developing</Chip>
  ) : (
    <Chip>● Stable</Chip>
  );
}

export function DisputeChip({ value }: { value: DisputeState }) {
  return value === "disputed" ? <Chip tone="bad">⚑ Disputed</Chip> : null;
}

export function LifecycleChip({ value }: { value: Lifecycle }) {
  switch (value) {
    case "corrected":
      return <Chip tone="info">✎ Corrected</Chip>;
    case "retracted":
      return <Chip tone="bad">✕ Retracted</Chip>;
    case "archived":
      return <Chip>▤ Archived</Chip>;
    default:
      return null;
  }
}

export function ProvenanceChip({ value }: { value: Provenance }) {
  if (!value.officialClaimPresent) return null;
  return (
    <Chip
      tone="info"
      title={`Claimed by ${value.officialClaimSource ?? "an official source"} — an official claim is not independent confirmation.`}
    >
      ◆ Claimed by {value.officialClaimSource ?? "official source"}
    </Chip>
  );
}

export function ConfidenceChip({ value }: { value: Confidence }) {
  const tone = value.band === "high" ? "good" : value.band === "moderate" ? "warn" : "bad";
  const label = value.band.charAt(0).toUpperCase() + value.band.slice(1);
  return (
    <Chip tone={tone} title={value.rationale}>
      ◈ {label} confidence
    </Chip>
  );
}

export function LabelRow({
  verification,
  maturity,
  dispute,
  lifecycle,
  provenance,
  confidence,
}: {
  verification: Verification;
  maturity?: Maturity;
  dispute?: DisputeState;
  lifecycle?: Lifecycle;
  provenance?: Provenance;
  confidence?: Confidence;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <VerificationChip value={verification} />
      {maturity ? <MaturityChip value={maturity} /> : null}
      {dispute ? <DisputeChip value={dispute} /> : null}
      {lifecycle ? <LifecycleChip value={lifecycle} /> : null}
      {provenance ? <ProvenanceChip value={provenance} /> : null}
      {confidence ? <ConfidenceChip value={confidence} /> : null}
    </div>
  );
}
