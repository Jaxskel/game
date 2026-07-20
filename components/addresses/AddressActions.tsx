"use client";

import { useEffect, useState } from "react";
import type { OfficialAddress } from "@/lib/domain/types";
import { formatInZone } from "@/lib/format";
import { prefs } from "@/lib/client/prefs";

/** Client-side actions: local-time display, calendar (.ics) download, follow
 * channel, and the post-follow notification permission prompt. */
export function AddressActions({
  address,
  localTimeOnly = false,
}: {
  address: OfficialAddress;
  localTimeOnly?: boolean;
}) {
  const [localZone, setLocalZone] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [notifyNote, setNotifyNote] = useState<string | null>(null);
  const channelId = `channel:${address.countryOrOrg}`;

  useEffect(() => {
    setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setFollowing(
      prefs.getFollows().some((f) => f.kind === "address-channel" && f.id === channelId),
    );
  }, [channelId]);

  if (localTimeOnly) {
    return localZone ? (
      <span style={{ color: "var(--muted)" }}>
        · your time: {formatInZone(address.scheduledAtUtc, localZone)}
      </span>
    ) : null;
  }

  function downloadIcs() {
    const dt = (iso: string) =>
      new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const end = new Date(
      new Date(address.scheduledAtUtc).getTime() + (address.durationMinutes ?? 60) * 60_000,
    ).toISOString();
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Global Conflict Monitor//EN",
      "BEGIN:VEVENT",
      `UID:${address.id}@gcm.demo`,
      `DTSTAMP:${dt(new Date().toISOString())}`,
      `DTSTART:${dt(address.scheduledAtUtc)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${address.title.replace(/[,;]/g, " ")}`,
      `DESCRIPTION:${address.speaker} — ${address.countryOrOrg}. Official source: ${address.officialSourceUrl}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${address.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleFollow() {
    const next = prefs.toggleFollow({
      kind: "address-channel",
      id: channelId,
      label: `${address.countryOrOrg} official addresses`,
    });
    const nowFollowing = next.some((f) => f.kind === "address-channel" && f.id === channelId);
    setFollowing(nowFollowing);
    // Notification permission is requested only AFTER a follow, per policy.
    if (nowFollowing && "Notification" in window && Notification.permission === "default") {
      try {
        const result = await Notification.requestPermission();
        setNotifyNote(
          result === "granted"
            ? "Notifications enabled for this channel (delivery requires the production push service — preferences saved locally in demo)."
            : "You can enable notifications later in Settings.",
        );
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="tap chip px-4" onClick={downloadIcs}>
          🗓 Add reminder (.ics)
        </button>
        <button
          type="button"
          className={`tap chip px-4 ${following ? "chip-active" : ""}`}
          aria-pressed={following}
          onClick={toggleFollow}
        >
          {following ? "✓ Following channel" : "+ Follow channel"}
        </button>
      </div>
      {notifyNote ? (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          {notifyNote}
        </p>
      ) : null}
    </div>
  );
}
