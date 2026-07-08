"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AnalysisDashboard from "@/components/AnalysisDashboard";
import { getBook } from "@/lib/db";
import { getOrCreateAnalysis } from "@/lib/analyze";
import type { BookAnalysis, BookRecord } from "@/lib/types";

export default function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = use(params);
  const [book, setBook] = useState<BookRecord | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const record = await getBook(bookId);
      if (cancelled) return;
      if (!record) {
        setBook(null);
        return;
      }
      setBook(record);
      try {
        const a = await getOrCreateAnalysis(
          bookId,
          record.title,
          record.author,
          (s) => !cancelled && setStatus(s),
        );
        if (!cancelled) setAnalysis(a);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Analysis failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (book === null) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-stone-600">
          This book isn&apos;t stored in this browser.
        </p>
        <Link href="/" className="mt-4 inline-block font-semibold text-amber-600 underline">
          Start with a new book →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-28 pt-8">
      <header className="mb-6">
        <Link href="/" className="text-sm text-stone-500 underline underline-offset-4">
          ← New book
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{book?.title ?? "…"}</h1>
        <p className="text-stone-600">{book?.author}</p>
        <p className="mt-1 text-xs text-stone-400">
          {book?.pageCount} pages · from{" "}
          {book?.provider === "gutenberg"
            ? "Project Gutenberg"
            : book?.provider === "archive"
              ? "Internet Archive"
              : "your upload"}
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {!analysis && !error && (
        <div className="flex flex-col gap-3" data-testid="analysis-loading">
          <div className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white">
            {status}
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-stone-200" />
          ))}
        </div>
      )}

      {analysis && <AnalysisDashboard analysis={analysis} />}

      {book && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/90 p-4 backdrop-blur">
          <Link
            href={`/book/${bookId}/reader`}
            data-testid="open-reader"
            className="mx-auto block max-w-md rounded-2xl bg-amber-500 px-6 py-4 text-center text-lg font-semibold text-white shadow-lg shadow-amber-200 active:scale-95 transition"
          >
            Open annotated book →
          </Link>
        </div>
      )}
    </main>
  );
}
