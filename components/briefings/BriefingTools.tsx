"use client";

import { useEffect, useRef, useState } from "react";

/** Listen (text-to-speech), save-for-offline, and share for a briefing. */
export function BriefingTools({ text, briefingId }: { text: string; briefingId: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [savedOffline, setSavedOffline] = useState<null | "saved" | "unavailable">(null);
  const [copied, setCopied] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setTtsAvailable(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  function toggleSpeech() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    utteranceRef.current = utterance;
    synth.speak(utterance);
    setSpeaking(true);
  }

  async function saveOffline() {
    if (!("caches" in window)) {
      setSavedOffline("unavailable");
      return;
    }
    try {
      const cache = await caches.open("gcm-offline-briefings");
      await cache.add(`/briefings/${briefingId}`);
      setSavedOffline("saved");
    } catch {
      setSavedOffline("unavailable");
    }
  }

  async function share() {
    const url = `${window.location.origin}/briefings/${briefingId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* unavailable */
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ttsAvailable ? (
        <button type="button" className="tap chip px-4" aria-pressed={speaking} onClick={toggleSpeech}>
          {speaking ? "⏹ Stop audio" : "🔊 Listen"}
        </button>
      ) : null}
      <button type="button" className="tap chip px-4" onClick={saveOffline}>
        {savedOffline === "saved"
          ? "✓ Saved offline"
          : savedOffline === "unavailable"
            ? "Offline save unavailable"
            : "⬇ Save offline"}
      </button>
      <button type="button" className="tap chip px-4" onClick={share}>
        {copied ? "✓ Link copied" : "↗ Share"}
      </button>
    </div>
  );
}
