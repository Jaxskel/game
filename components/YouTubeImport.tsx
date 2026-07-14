"use client";

import { useState } from "react";

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i;

/** Paste a YouTube link to a book — audiobook or on-screen page video. */
export default function YouTubeImport({
  onImport,
  disabled,
}: {
  onImport: (url: string) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const valid = YT_RE.test(url.trim());

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-stone-700">
        ▶️ From a YouTube link{" "}
        <span className="font-normal text-stone-500">
          — paste an audiobook or a video that shows the pages, and I&apos;ll
          transcribe it into an annotatable book.
        </span>
      </p>
      <p className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-900">
        Works best with a chapter-length clip (under ~30 min). Very long
        audiobooks may time out — do it a chapter at a time.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=…"
          inputMode="url"
          data-testid="youtube-url-input"
          className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={() => onImport(url.trim())}
          disabled={disabled || !valid}
          data-testid="youtube-import"
          className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow active:scale-95 transition disabled:opacity-40"
        >
          Use video →
        </button>
      </div>
    </div>
  );
}
