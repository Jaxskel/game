"use client";

import { useState } from "react";
import type { IdentifyResult } from "@/lib/types";

export default function BookConfirmCard({
  result,
  photoUrl,
  onConfirm,
  onRetake,
}: {
  result: IdentifyResult | null; // null = manual entry
  photoUrl: string | null;
  onConfirm: (title: string, author: string) => void;
  onRetake: () => void;
}) {
  const [title, setTitle] = useState(result?.title ?? "");
  const [author, setAuthor] = useState(result?.author ?? "");
  const lowConfidence = result !== null && result.confidence < 0.6;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-bold">
        {result ? "Is this your book?" : "What book is it?"}
      </h2>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Your book cover photo"
          className="mx-auto max-h-48 rounded-lg shadow"
        />
      )}
      {result && (
        <p className="text-sm text-stone-600">
          {result.identified
            ? `I'm ${Math.round(result.confidence * 100)}% sure this is it${lowConfidence ? " — please double-check" : ""}:`
            : "I couldn't recognize the cover — type it in below:"}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Romeo and Juliet"
          data-testid="title-input"
          className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Author
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="e.g. William Shakespeare"
          data-testid="author-input"
          className="rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
        />
      </label>
      {result?.alternates && result.alternates.length > 0 && (
        <div className="text-sm">
          <p className="mb-1 text-stone-500">Or did you mean:</p>
          <div className="flex flex-wrap gap-2">
            {result.alternates.map((alt) => (
              <button
                key={`${alt.title}-${alt.author}`}
                onClick={() => {
                  setTitle(alt.title);
                  setAuthor(alt.author);
                }}
                className="rounded-full border border-stone-300 bg-white px-3 py-1"
              >
                {alt.title} — {alt.author}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => onConfirm(title.trim(), author.trim())}
        disabled={!title.trim()}
        data-testid="confirm-book"
        className="rounded-2xl bg-amber-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-200 active:scale-95 transition disabled:opacity-40"
      >
        Find this book →
      </button>
      <button onClick={onRetake} className="text-sm text-stone-500 underline underline-offset-4">
        ← Start over
      </button>
    </div>
  );
}
