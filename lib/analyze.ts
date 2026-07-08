"use client";

import { getAnalysis, getPdfBytes, saveAnalysis } from "./db";
import { getPdfjs } from "./pdf/worker";
import { extractAllPages } from "./pdf/extract";
import type { BookAnalysis } from "./types";

const FULL_CALL_LIMIT = 3_500_000; // chars; under Vercel's 4.5MB body cap
const CHUNK_SIZE = 3_000_000;

async function callAnalyze(body: unknown): Promise<BookAnalysis> {
  const res = await fetch("/api/analyze-book", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `analysis failed (${res.status})`);
  }
  return data.analysis as BookAnalysis;
}

/** Extract the full text of a stored book (also used by the reader). */
export async function extractBookText(bookId: string): Promise<string> {
  const bytes = await getPdfBytes(bookId);
  if (!bytes) throw new Error("book file missing from this browser");
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const pages = await extractAllPages(doc);
  await doc.loadingTask.destroy();
  return pages.map((p) => p.text).join("\n\n");
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > CHUNK_SIZE) {
    // Prefer splitting at a paragraph boundary near the target size.
    let cut = rest.lastIndexOf("\n\n", CHUNK_SIZE);
    if (cut < CHUNK_SIZE * 0.5) cut = CHUNK_SIZE;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) chunks.push(rest);
  return chunks;
}

export async function getOrCreateAnalysis(
  bookId: string,
  title: string,
  author: string,
  onStatus: (s: string) => void,
): Promise<BookAnalysis> {
  const cached = await getAnalysis(bookId);
  if (cached) return cached;

  onStatus("Reading every page of the book…");
  const text = await extractBookText(bookId);

  let analysis: BookAnalysis;
  if (text.length <= FULL_CALL_LIMIT) {
    onStatus("Analyzing the whole book…");
    analysis = await callAnalyze({ title, author, mode: "full", text });
  } else {
    const chunks = splitIntoChunks(text);
    const partials: BookAnalysis[] = [];
    for (let i = 0; i < chunks.length; i++) {
      onStatus(`Analyzing part ${i + 1} of ${chunks.length}…`);
      partials.push(
        await callAnalyze({
          title,
          author,
          mode: "chunk",
          text: chunks[i],
          chunkIndex: i,
          chunkCount: chunks.length,
        }),
      );
    }
    onStatus("Combining the analysis…");
    analysis = await callAnalyze({ title, author, mode: "reduce", partials });
  }

  await saveAnalysis(bookId, analysis);
  return analysis;
}
