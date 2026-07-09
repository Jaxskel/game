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
// Free-tier Gemini keys allow ~10 requests/minute — pace between batches and
// wait long on 429s instead of failing.
const BATCH_GAP_MS = 1_500;
const RATE_LIMIT_WAITS_MS = [12_000, 25_000, 40_000];
const NETWORK_WAITS_MS = [2_000, 5_000];

// Serialize all annotation calls (express-mode Gemini keys have tight rate
// limits) and dedupe pages already queued this session.
let chain: Promise<void> = Promise.resolve();
const queuedPages = new Set<string>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callAnnotate(
  meta: AnnotateMeta,
  pages: { page: number; text: string }[],
  onWait?: (msg: string) => void,
): Promise<Annotation[]> {
  let lastErr: unknown;
  let rateLimitHits = 0;
  let networkHits = 0;
  for (;;) {
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
      if (res.ok) return data.annotations as Annotation[];
      const msg = data?.error?.message ?? `annotation failed (${res.status})`;
      lastErr = new Error(msg);
      if (res.status === 429 || res.status === 503) {
        if (rateLimitHits >= RATE_LIMIT_WAITS_MS.length) break;
        const wait = RATE_LIMIT_WAITS_MS[rateLimitHits++];
        onWait?.(`Gemini is rate-limited — waiting ${Math.round(wait / 1000)}s…`);
        await sleep(wait);
        continue;
      }
      if (res.status >= 500) {
        if (networkHits >= NETWORK_WAITS_MS.length) break;
        await sleep(NETWORK_WAITS_MS[networkHits++]);
        continue;
      }
      throw lastErr; // real 4xx — don't retry
    } catch (e) {
      if (e === lastErr) throw e;
      // Network-level failure (Safari: "Load failed") — retry briefly.
      lastErr = e;
      if (networkHits >= NETWORK_WAITS_MS.length) break;
      await sleep(NETWORK_WAITS_MS[networkHits++]);
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
  onStatus?: (message: string) => void,
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
          onStatus,
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
      // Gentle pacing between batches keeps free-tier keys under their RPM cap.
      if (i + BATCH_SIZE < missing.length) await sleep(BATCH_GAP_MS);
    }
  });
  chain = result.catch(() => {});
  return result;
}
