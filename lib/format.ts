/** Date/time formatting shared by server and client components. */

export function formatUtc(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " UTC"
  );
}

export function formatInZone(iso: string, timeZone: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return formatUtc(iso);
  }
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const fmt = (n: number, unit: string) =>
    diffMs < 0 ? `${n} ${unit}${n === 1 ? "" : "s"} ago` : `in ${n} ${unit}${n === 1 ? "" : "s"}`;
  if (abs < min) return diffMs < 0 ? "just now" : "now";
  if (abs < hour) return fmt(Math.round(abs / min), "minute");
  if (abs < day) return fmt(Math.round(abs / hour), "hour");
  return fmt(Math.round(abs / day), "day");
}

/** "reported N minutes later" qualifier between event and first report. */
export function reportLagQualifier(eventIso: string, reportedIso: string): string | null {
  const lagMs = new Date(reportedIso).getTime() - new Date(eventIso).getTime();
  if (lagMs <= 0) return null;
  const minutes = Math.round(lagMs / 60_000);
  if (minutes < 60) return `reported ${minutes} min later`;
  const hours = Math.round(minutes / 60);
  return `reported ${hours} hour${hours === 1 ? "" : "s"} later`;
}

export function timePrecisionLabel(
  precision: "exact" | "hour" | "part-of-day" | "day",
): string {
  switch (precision) {
    case "exact":
      return "Exact time";
    case "hour":
      return "Approximate hour";
    case "part-of-day":
      return "Part of day";
    case "day":
      return "Date only";
  }
}
