"use client";

import type { BookSourceCandidate } from "@/lib/types";
import UploadDropzone from "./UploadDropzone";
import SnapPages from "./SnapPages";
import YouTubeImport from "./YouTubeImport";

export default function SourcePicker({
  sources,
  loading,
  status,
  onPick,
  onUpload,
  onSnapPages,
  onSnapVideo,
  onYouTube,
  onBack,
}: {
  sources: BookSourceCandidate[];
  loading: boolean;
  status: string | null;
  onPick: (s: BookSourceCandidate) => void;
  onUpload: (file: File) => void;
  onSnapPages: (files: File[]) => void;
  onSnapVideo: (file: File) => void;
  onYouTube: (url: string) => void;
  onBack: () => void;
}) {
  const busy = status !== null;
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">Get the book</h2>

      {loading && (
        <div className="animate-pulse rounded-xl border border-stone-200 bg-white p-4 text-stone-500">
          Searching Project Gutenberg &amp; the Internet Archive…
        </div>
      )}

      {!loading && sources.length === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No free public-domain copy found — this book is probably still under
          copyright. Upload your own PDF of it below and everything still works.
        </div>
      )}

      {sources.map((s, i) => (
        <button
          key={`${s.provider}-${s.id}`}
          onClick={() => onPick(s)}
          disabled={busy}
          data-testid={`source-${s.provider}-${i}`}
          className="rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition active:scale-[.98] disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">{s.title}</span>
            {s.provider === "gutenberg" && i === 0 && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                Recommended
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-stone-600">{s.author}</div>
          <div className="mt-1 text-xs text-stone-500">
            {s.provider === "gutenberg"
              ? "Project Gutenberg — full text, free, clean pages"
              : "Internet Archive — scanned PDF (may lack selectable text)"}
          </div>
        </button>
      ))}

      <div className="mt-2">
        <p className="mb-2 text-sm font-medium text-stone-700">
          Own the book as a PDF or EPUB ebook?{" "}
          <span className="text-stone-500">
            Upload it — a PDF&apos;s highlights match your page numbers
            exactly. (Kindle/Apple books are DRM-locked and can&apos;t be
            opened.)
          </span>
        </p>
        <UploadDropzone onFile={onUpload} disabled={busy} />
      </div>

      <SnapPages onBuild={onSnapPages} onVideo={onSnapVideo} disabled={busy} />

      <YouTubeImport onImport={onYouTube} disabled={busy} />

      {status && (
        <div
          className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white"
          data-testid="ingest-status"
        >
          {status}
        </div>
      )}

      <button onClick={onBack} disabled={busy} className="text-sm text-stone-500 underline underline-offset-4">
        ← Back
      </button>
    </div>
  );
}
