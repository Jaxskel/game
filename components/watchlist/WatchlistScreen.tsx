"use client";

import { useEffect, useState } from "react";
import {
  prefs,
  type FollowedTopic,
  type NotificationPrefs,
} from "@/lib/client/prefs";

interface Props {
  countries: { code: string; name: string }[];
  regions: string[];
  conflicts: { id: string; name: string }[];
  channels: string[];
}

/**
 * Follow countries, regions, conflicts, and official-address channels — no
 * account required (stored locally). Notification preferences include quiet
 * hours, per-topic mute, and full opt-out; delivery itself needs the
 * production push service and is honestly labeled as BLOCKED in demo.
 */
export function WatchlistScreen({ countries, regions, conflicts, channels }: Props) {
  const [follows, setFollows] = useState<FollowedTopic[]>([]);
  const [notif, setNotif] = useState<NotificationPrefs | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFollows(prefs.getFollows());
    setNotif(prefs.getNotifications());
  }, []);

  function toggle(topic: FollowedTopic) {
    setFollows(prefs.toggleFollow(topic));
    // Notification permission is requested only after the user follows
    // something — never on app load.
    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !prefs.getFollows().length
    ) {
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }

  const isFollowed = (kind: FollowedTopic["kind"], id: string) =>
    follows.some((f) => f.kind === kind && f.id === id);

  function updateNotif(patch: Partial<NotificationPrefs>) {
    if (!notif) return;
    const next = { ...notif, ...patch };
    setNotif(next);
    prefs.setNotifications(next);
  }

  function FollowChip({ topic }: { topic: FollowedTopic }) {
    const active = isFollowed(topic.kind, topic.id);
    return (
      <button
        type="button"
        className={`tap chip ${active ? "chip-active" : ""}`}
        aria-pressed={active}
        onClick={() => toggle(topic)}
      >
        {active ? "✓ " : "+ "}
        {topic.label}
      </button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-3">
      <h1 className="px-1 py-2 text-xl font-bold">Watchlist</h1>
      <p className="px-1 pb-2 text-sm" style={{ color: "var(--muted)" }}>
        Follow topics to build your Following feed. No account needed — your
        choices stay on this device.
      </p>

      {follows.length > 0 ? (
        <section className="card p-3">
          <h2 className="text-sm font-bold">Following ({follows.length})</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {follows.map((f) => (
              <span key={`${f.kind}:${f.id}`} className="chip chip-active">
                {f.label}
                <button
                  type="button"
                  aria-label={`Unfollow ${f.label}`}
                  className="ml-1"
                  onClick={() => setFollows(prefs.toggleFollow(f))}
                >
                  ✕
                </button>
                <button
                  type="button"
                  aria-label={`${muted.has(f.id) ? "Unmute" : "Mute"} ${f.label}`}
                  className="ml-1"
                  title="Mute notifications for this topic"
                  onClick={() =>
                    setMuted((prev) => {
                      const next = new Set(prev);
                      if (next.has(f.id)) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                >
                  {muted.has(f.id) ? "🔕" : "🔔"}
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="px-1 text-sm font-bold">Countries</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {countries.map((c) => (
            <FollowChip key={c.code} topic={{ kind: "country", id: c.code, label: c.name }} />
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="px-1 text-sm font-bold">Regions</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {regions.map((r) => (
            <FollowChip key={r} topic={{ kind: "region", id: r, label: r }} />
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="px-1 text-sm font-bold">Conflicts</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {conflicts.map((c) => (
            <FollowChip key={c.id} topic={{ kind: "conflict", id: c.id, label: c.name }} />
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h2 className="px-1 text-sm font-bold">Official-address channels</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 px-1">
          {channels.map((ch) => (
            <FollowChip
              key={ch}
              topic={{ kind: "address-channel", id: `channel:${ch}`, label: `${ch} addresses` }}
            />
          ))}
        </div>
      </section>

      {notif ? (
        <section className="card mt-5 p-3">
          <h2 className="text-sm font-bold">Notifications</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Defaults favor high-significance corroborated updates to avoid alarm
            fatigue. Hyperlocal tactical or movement alerts are never sent.
            Delivery requires the production push service — in demo mode these
            preferences are saved locally only.
          </p>
          {(
            [
              ["majorDevelopments", "Major corroborated developments"],
              ["officialAddresses", "Official addresses"],
              ["briefingReady", "Briefing ready"],
              ["dailyDigest", "Daily digest"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm">
              {label}
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={notif[key]}
                onChange={(e) => updateNotif({ [key]: e.target.checked })}
              />
            </label>
          ))}
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span>Level</span>
            <select
              aria-label="Notification level"
              className="h-11 rounded-lg border px-2"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              value={notif.level}
              onChange={(e) => updateNotif({ level: e.target.value as NotificationPrefs["level"] })}
            >
              <option value="high-significance">High-significance only (default)</option>
              <option value="all-corroborated">All corroborated updates</option>
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span>Quiet hours</span>
            <span className="flex items-center gap-1">
              <input
                type="time"
                aria-label="Quiet hours start"
                className="h-11 rounded-lg border px-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                value={notif.quietHoursStart}
                onChange={(e) => updateNotif({ quietHoursStart: e.target.value })}
              />
              –
              <input
                type="time"
                aria-label="Quiet hours end"
                className="h-11 rounded-lg border px-2"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
                value={notif.quietHoursEnd}
                onChange={(e) => updateNotif({ quietHoursEnd: e.target.value })}
              />
            </span>
          </div>
          <button
            type="button"
            className="tap chip mt-3"
            onClick={() =>
              updateNotif({
                majorDevelopments: false,
                officialAddresses: false,
                briefingReady: false,
                dailyDigest: false,
              })
            }
          >
            Opt out of all notifications
          </button>
        </section>
      ) : null}
    </div>
  );
}
