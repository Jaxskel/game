"use client";

import { useEffect, useState } from "react";
import { prefs, type Theme } from "@/lib/client/prefs";

const SCREENS = [
  {
    title: "Attributed public reporting",
    body: "Global Conflict Monitor combines publicly reported information from named sources. Every incident shows who reported what — official claims are labeled as claims, never as independent confirmation.",
  },
  {
    title: "Labels, not verdicts",
    body: "Verification (Unverified / Single-source / Corroborated) describes independent sourcing. Event time is when something happened; publication time is when it was reported. Confidence describes the reporting, with a plain-language explanation.",
  },
  {
    title: "Before you start",
    body: "Conflict information can be incomplete, disputed, or distressing. Locations of active events are generalized on purpose. You can pick a theme now and follow topics later — notification permission is only requested after you follow something.",
  },
] as const;

/** Three skippable onboarding screens, shown once. */
export function OnboardingGate() {
  const [step, setStep] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    if (!prefs.isOnboarded()) setStep(0);
  }, []);

  if (step === null) return null;

  function finish() {
    prefs.setOnboarded(true);
    setStep(null);
  }

  const screen = SCREENS[step];

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6"
      style={{ background: "var(--bg)", paddingTop: "var(--sat)", paddingBottom: "var(--nav-h)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
    >
      <div className="w-full max-w-sm">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
          {step + 1} / {SCREENS.length}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{screen.title}</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {screen.body}
        </p>

        {step === 2 ? (
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">Theme</legend>
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
          </fieldset>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <button type="button" className="tap chip px-4" onClick={finish}>
            Skip
          </button>
          <button
            type="button"
            className="tap chip chip-active px-6 font-semibold"
            onClick={() => (step < SCREENS.length - 1 ? setStep(step + 1) : finish())}
          >
            {step < SCREENS.length - 1 ? "Next" : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
