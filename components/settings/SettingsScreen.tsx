"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { prefs, type Theme } from "@/lib/client/prefs";

interface AdapterInfo {
  id: string;
  name: string;
  type: string;
  licenseNotes: string;
  availability: { state: "ready" } | { state: "blocked"; reason: string };
}

export function SettingsScreen() {
  const [theme, setTheme] = useState<Theme>("system");
  const [timezone, setTimezone] = useState("");
  const [adapters, setAdapters] = useState<AdapterInfo[] | null>(null);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    setTheme(prefs.getTheme());
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    fetch("/api/v1/meta")
      .then((r) => r.json())
      .then((data) => setAdapters(data.adapters ?? []))
      .catch(() => setAdapters([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl p-3">
      <h1 className="px-1 py-2 text-xl font-bold">Settings</h1>

      <section className="card p-3">
        <h2 className="text-sm font-bold">Appearance</h2>
        <div className="mt-2 flex gap-1.5">
          {(["system", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`tap chip capitalize ${theme === t ? "chip-active" : ""}`}
              aria-pressed={theme === t}
              onClick={() => {
                setTheme(t);
                prefs.setTheme(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          Language: English (translations of source material are always labeled
          as machine translation). Reduced-motion and text-zoom follow your
          system settings.
        </p>
      </section>

      <section className="card mt-3 p-3">
        <h2 className="text-sm font-bold">Time zone</h2>
        <p className="mt-1 text-sm">
          Times display in <strong>{timezone || "your local zone"}</strong> with
          UTC alongside. Event-locale time is shown on each incident.
        </p>
      </section>

      <section className="card mt-3 p-3">
        <h2 className="text-sm font-bold">Notifications & follows</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Managed in the Watchlist tab — including quiet hours, per-topic mute,
          and complete opt-out.
        </p>
        <Link href="/watchlist" className="chip tap mt-2 inline-flex px-4">
          Open Watchlist →
        </Link>
      </section>

      <section className="card mt-3 p-3">
        <h2 className="text-sm font-bold">Data & privacy</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Reading requires no account. Follows, saved items, and preferences
          live only in this browser. There is no tracking analytics and the app
          never requests your precise location.
        </p>
        <button
          type="button"
          className="tap chip mt-2 px-4"
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          onClick={() => {
            prefs.clearAll();
            setCleared(true);
          }}
        >
          {cleared ? "✓ Local data cleared" : "Clear all local data"}
        </button>
      </section>

      <section className="card mt-3 p-3">
        <h2 className="text-sm font-bold">Source transparency</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Every configured source adapter and its live status. In demo mode the
          fixture adapter supplies a fictional scenario; live integrations are
          implemented behind interfaces and blocked until credentials and
          licenses are confirmed.
        </p>
        {adapters === null ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Loading…
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {adapters.map((a) => (
              <li key={a.id} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{a.name}</span>
                  {a.availability.state === "ready" ? (
                    <span className="chip" style={{ borderColor: "var(--ok)", color: "var(--ok)" }}>
                      Active
                    </span>
                  ) : (
                    <span className="chip" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                      Blocked
                    </span>
                  )}
                </div>
                <p className="mt-1" style={{ color: "var(--muted)" }}>
                  {a.licenseNotes}
                </p>
                {a.availability.state === "blocked" ? (
                  <p className="mt-1" style={{ color: "var(--muted)" }}>
                    {a.availability.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-3 p-3">
        <h2 className="text-sm font-bold">About & safety</h2>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Global Conflict Monitor is a public-interest news and
          situational-awareness product built from attributed public reporting.
          It is not a targeting, surveillance, or military-intelligence tool:
          locations of active events are generalized, kinetic incidents are
          published only after a safety delay and risk review, and movement is
          never tracked or inferred. Conflict information can be incomplete,
          disputed, or distressing.
        </p>
        <button
          type="button"
          className="tap chip mt-2 px-4"
          onClick={() => {
            prefs.setOnboarded(false);
            window.location.href = "/";
          }}
        >
          Replay intro
        </button>
      </section>
    </div>
  );
}
