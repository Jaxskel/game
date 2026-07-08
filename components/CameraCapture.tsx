"use client";

import { useRef } from "react";

export default function CameraCapture({
  onImage,
  onSkip,
  busy,
}: {
  onImage: (file: File) => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="text-6xl" aria-hidden>
        📚
      </div>
      <div>
        <h1 className="text-2xl font-bold">Book Annotator</h1>
        <p className="mt-2 max-w-sm text-stone-600">
          Snap a photo of your book&apos;s cover. We&apos;ll identify it, pull up
          the text, and mark it up with highlights and margin notes you can copy
          straight into your physical copy.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-testid="cover-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImage(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full max-w-xs rounded-2xl bg-amber-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-200 active:scale-95 transition disabled:opacity-50"
      >
        {busy ? "Identifying…" : "📷 Snap your book cover"}
      </button>
      <button
        onClick={onSkip}
        disabled={busy}
        className="text-sm text-stone-500 underline underline-offset-4"
        data-testid="skip-photo"
      >
        No photo? Type the title instead
      </button>
    </div>
  );
}
