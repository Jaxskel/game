"use client";

import Link from "next/link";
import type { OfficialAddress } from "@/lib/domain/types";
import { formatUtc, relativeTime } from "@/lib/format";
import { AddressStateChip } from "./AddressStateChip";

export function AddressCard({ address }: { address: OfficialAddress }) {
  return (
    <Link href={`/addresses/${address.id}`} className="card block p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        <AddressStateChip state={address.state} />
        <span>{address.countryOrOrg}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={address.scheduledAtUtc}>
          {formatUtc(address.scheduledAtUtc)} ({relativeTime(address.scheduledAtUtc)})
        </time>
      </div>
      <h2 className="mt-1.5 text-[15px] font-bold leading-snug">{address.title}</h2>
      <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
        {address.speaker} — {address.office} · {address.topic}
      </p>
    </Link>
  );
}
