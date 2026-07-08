"use client";

import { useState } from "react";

export default function PageNav({
  page,
  numPages,
  onGoto,
}: {
  page: number;
  numPages: number;
  onGoto: (p: number) => void;
}) {
  const [jump, setJump] = useState("");
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onGoto(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        data-testid="prev-page"
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-30"
      >
        ‹
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseInt(jump, 10);
          if (!Number.isNaN(n)) onGoto(n);
          setJump("");
        }}
        className="flex items-center gap-1 text-sm"
      >
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          placeholder={String(page)}
          inputMode="numeric"
          aria-label="Jump to page"
          className="w-12 rounded-lg border border-stone-300 bg-white px-1 py-1.5 text-center"
        />
        <span className="text-stone-500">/ {numPages}</span>
      </form>
      <button
        onClick={() => onGoto(page + 1)}
        disabled={page >= numPages}
        aria-label="Next page"
        data-testid="next-page"
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}
