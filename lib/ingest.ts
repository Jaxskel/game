"use client";

import { getPdfjs } from "./pdf/worker";
import { extractPage, pageHasTextLayer } from "./pdf/extract";
import { textToPdf } from "./pdf/textToPdf";
import { saveBook } from "./db";
import type { BookRecord, BookSourceCandidate } from "./types";

export class IngestError extends Error {}

async function loadPdfDoc(bytes: ArrayBuffer) {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({ data: bytes.slice(0) }).promise;
}

/** Reject scanned PDFs with no selectable text (probe a few early pages). */
async function assertTextLayer(bytes: ArrayBuffer): Promise<number> {
  const doc = await loadPdfDoc(bytes);
  const probePages = [3, 4, 5, 1, 2]
    .filter((p) => p <= doc.numPages)
    .slice(0, 3);
  let ok = false;
  for (const p of probePages) {
    const page = await extractPage(await doc.getPage(p), p);
    if (pageHasTextLayer(page)) {
      ok = true;
      break;
    }
  }
  const numPages = doc.numPages;
  await doc.loadingTask.destroy();
  if (!ok) {
    throw new IngestError(
      "This PDF has no selectable text (it's probably a scan). Please upload a text-based PDF, or pick the Project Gutenberg version instead.",
    );
  }
  return numPages;
}

async function fetchViaProxy(url: string, onProgress?: (pct: number | null) => void) {
  const res = await fetch(`/api/fetch-book?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      if (data?.error?.message) detail = ` — ${data.error.message}`;
    } catch {
      // non-JSON error body
    }
    throw new IngestError(
      `Download failed (${res.status}${detail}). Try another source below, or upload your own PDF.`,
    );
  }
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(total ? Math.round((received / total) * 100) : null);
  }
  const out = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out.buffer as ArrayBuffer;
}

/** Download/convert a chosen source into a stored, ready-to-read book. */
export async function ingestSource(
  source: BookSourceCandidate,
  title: string,
  author: string,
  onStatus: (status: string, pct?: number | null) => void,
): Promise<string> {
  onStatus("Downloading…");
  const bytes = await fetchViaProxy(source.downloadUrl, (pct) =>
    onStatus("Downloading…", pct),
  );

  let pdfBytes: ArrayBuffer;
  if (source.format === "text") {
    onStatus("Turning the text into a clean PDF…");
    const text = new TextDecoder("utf-8").decode(bytes);
    if (text.length < 1000) {
      throw new IngestError("The downloaded file looks empty or corrupted.");
    }
    const pdf = await textToPdf(text, title, author);
    pdfBytes = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
  } else {
    pdfBytes = bytes;
  }

  onStatus("Checking the pages…");
  const pageCount = await assertTextLayer(pdfBytes);

  const record: BookRecord = {
    bookId: crypto.randomUUID(),
    title,
    author,
    provider: source.provider,
    createdAt: Date.now(),
    pageCount,
  };
  await saveBook(record, pdfBytes);
  return record.bookId;
}

/** Store a user-uploaded PDF as a ready-to-read book. */
export async function ingestUpload(
  file: File,
  title: string,
  author: string,
  onStatus: (status: string) => void,
): Promise<string> {
  if (file.size > 50 * 1024 * 1024) {
    throw new IngestError("That PDF is over 50MB — try a smaller file.");
  }
  onStatus("Reading your PDF…");
  const bytes = await file.arrayBuffer();
  const pageCount = await assertTextLayer(bytes);
  const record: BookRecord = {
    bookId: crypto.randomUUID(),
    title: title || file.name.replace(/\.pdf$/i, ""),
    author,
    provider: "upload",
    createdAt: Date.now(),
    pageCount,
  };
  await saveBook(record, bytes);
  return record.bookId;
}
