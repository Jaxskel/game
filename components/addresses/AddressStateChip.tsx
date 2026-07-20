import type { OfficialAddress } from "@/lib/domain/types";

/** Address lifecycle chip — pure JSX, renderable from server and client
 * components alike. */
export function AddressStateChip({ state }: { state: OfficialAddress["state"] }) {
  switch (state) {
    case "live":
      return (
        <span className="chip font-semibold" style={{ borderColor: "var(--live)", color: "var(--live)" }}>
          <span className="live-dot" aria-hidden="true" /> Live
        </span>
      );
    case "upcoming":
      return (
        <span className="chip" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
          Upcoming
        </span>
      );
    case "ended":
      return <span className="chip">Ended</span>;
    case "cancelled":
      return (
        <span className="chip" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          Cancelled
        </span>
      );
    case "replay-available":
      return (
        <span className="chip" style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
          ▶ Replay available
        </span>
      );
    case "replay-unavailable":
      return <span className="chip">Ended — no replay</span>;
  }
}
