"use client";

import { getPageAnnotations, savePageAnnotations } from "./db";
import type { Annotation, ExtractedPage } from "./types";

export interface AnnotateMeta {
  bookId: string;
  title: string;
  author: string;
  analysisContext: { characters: string[]; themes: string[] };
}

// Small batches keep each request fast enough for mobile connections and
// Vercel's function time limit (rate-limit retries happen server-side too).
const BATCH_SIZE = 3;
const CLIENT_RETRIES = 2;

// Serialize all annotation calls (express-mode Gemini keys have tight rate
// limits) and dedupe pages already queued this session.
let chain: Promise<void> = Promise.resolve();
const queuedPages = new Set<string>();

async function callAnnotate(
  meta: AnnotateMeta,
  pages: { page: number; text: string }[],
): Promise<Annotation[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CLIENT_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/annotate-pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          author: meta.author,
          analysisContext: meta.analysisContext,
          pages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message ?? `annotation failed (${res.status})`;
        // Retry rate limits / upstream flakiness; bail on real 4xx errors.
        if (res.status < 500 && res.status !== 429) throw new Error(msg);
        lastErr = new Error(msg);
      } else {
        return data.annotations as Annotation[];
      }
    } catch (e) {
      // Network-level failure (Safari: "Load failed") — retry.
      lastErr = e;
    }
    if (attempt < CLIENT_RETRIES) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("annotation failed");
}

/**
 * Make sure every given page has annotations (cached in IndexedDB — each
 * page is sent to the LLM exactly once, ever). Calls onPage as each page's
 * annotations become available.
 */
export function ensureAnnotations(
  meta: AnnotateMeta,
  pages: ExtractedPage[],
  onPage: (page: number, annotations: Annotation[]) => void,
  onError?: (message: string) => void,
): Promise<void> {
  const result = chain.then(async () => {
    const missing: ExtractedPage[] = [];
    for (const p of pages) {
      const key = `${meta.bookId}:${p.page}`;
      const cached = await getPageAnnotations(meta.bookId, p.page);
      if (cached) {
        onPage(p.page, cached);
      } else if (!queuedPages.has(key)) {
        queuedPages.add(key);
        missing.push(p);
      }
    }

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      try {
        const annotations = await callAnnotate(
          meta,
          batch.map((p) => ({ page: p.page, text: p.text.slice(0, 20_000) })),
        );
        for (const p of batch) {
          const forPage = annotations.filter((a) => a.page === p.page);
          // Store empty results too, so a front-matter page isn't re-sent.
          await savePageAnnotations(meta.bookId, p.page, forPage);
          onPage(p.page, forPage);
        }
      } catch (e) {
        for (const p of batch) queuedPages.delete(`${meta.bookId}:${p.page}`);
        onError?.(e instanceof Error ? e.message : "annotation failed");
      }
    }
  });
  chain = result.catch(() => {});
  return result;
}
