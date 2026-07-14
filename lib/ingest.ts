"use client";

import { getPdfjs } from "./pdf/worker";
import { extractPage, pageHasTextLayer } from "./pdf/extract";
import { textToPdf } from "./pdf/textToPdf";
import { EpubError, epubToText } from "./epub";
import { compressImage } from "./image";
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
  // Book sites rate-limit bursts — retry the download a couple of times
  // before giving up.
  let res: Response | null = null;
  let detail = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      onProgress?.(null);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    try {
      res = await fetch(`/api/fetch-book?url=${encodeURIComponent(url)}`);
    } catch {
      res = null;
      detail = " — network error";
      continue;
    }
    if (res.ok) break;
    try {
      const data = await res.json();
      if (data?.error?.message) detail = ` — ${data.error.message}`;
    } catch {
      // non-JSON error body
    }
    if (res.status < 500) break; // our own 4xx — retrying won't help
  }
  if (!res || !res.ok) {
    throw new IngestError(
      `Download failed (${res?.status ?? "network"}${detail}). Try again in a minute, pick another source below, or upload your own PDF.`,
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
    generatedPdf: source.format === "text",
  };
  await saveBook(record, pdfBytes);
  return record.bookId;
}

/**
 * Build a book from a YouTube video — audiobook (read aloud) or a page/screen
 * video (text shown). Gemini transcribes it; we lay the text out as pages.
 */
export async function ingestYouTube(
  url: string,
  title: string,
  author: string,
  onStatus: (status: string) => void,
): Promise<string> {
  onStatus("Watching the video & transcribing… (this can take a minute)");
  const res = await fetch("/api/youtube", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new IngestError(
      `Couldn't transcribe that video${
        data?.error?.message ? ` — ${data.error.message}` : ""
      }. Try a shorter, chapter-length video, or make sure the link is public.`,
    );
  }
  const text: string = data.text ?? "";
  if (text.replace(/\s+/g, "").length < 300) {
    throw new IngestError(
      "The video didn't yield enough readable text — try a clearer audiobook or page video.",
    );
  }

  onStatus("Building your book pages…");
  const pdf = await textToPdf(text, title || "My Book", author || "");
  const pdfBytes = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength,
  ) as ArrayBuffer;
  const pageCount = await assertTextLayer(pdfBytes);
  const record: BookRecord = {
    bookId: crypto.randomUUID(),
    title: title || "My Book",
    author,
    provider: "upload",
    createdAt: Date.now(),
    pageCount,
    generatedPdf: true,
  };
  await saveBook(record, pdfBytes);
  return record.bookId;
}

/**
 * Build a book from photos of a physical book's pages: OCR each photo via
 * the server (Gemini vision), then lay the text out as annotatable pages.
 * The user's own paper copy becomes a digital study copy on their device.
 */
export async function ingestPhotos(
  files: File[],
  title: string,
  author: string,
  onStatus: (status: string) => void,
): Promise<string> {
  if (files.length === 0) throw new IngestError("No photos selected.");
  if (files.length > 60) {
    throw new IngestError("That's a lot of photos — 60 max per batch, please.");
  }

  const texts: string[] = [];
  const BATCH = 3;
  for (let i = 0; i < files.length; i += BATCH) {
    const group = files.slice(i, i + BATCH);
    onStatus(
      `Reading your pages… ${Math.min(i + group.length, files.length)}/${files.length}`,
    );
    const images = await Promise.all(
      group.map((f) => compressImage(f, 1600, 0.82)),
    );
    const res = await fetch("/api/ocr-pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new IngestError(
        `Couldn't read pages ${i + 1}–${i + group.length}${
          data?.error?.message ? ` — ${data.error.message}` : ""
        }. Try retaking those photos with good light.`,
      );
    }
    texts.push(...(data.pages ?? []));
  }

  const fullText = texts.join("\n\n");
  if (fullText.replace(/\s+/g, "").length < 300) {
    throw new IngestError(
      "Couldn't read enough text from these photos — retake them closer and in good light.",
    );
  }

  onStatus("Building your book pages…");
  const pdf = await textToPdf(fullText, title || "My Book", author || "");
  const pdfBytes = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength,
  ) as ArrayBuffer;
  const pageCount = await assertTextLayer(pdfBytes);
  const record: BookRecord = {
    bookId: crypto.randomUUID(),
    title: title || "My Book",
    author,
    provider: "upload",
    createdAt: Date.now(),
    pageCount,
    generatedPdf: true,
  };
  await saveBook(record, pdfBytes);
  return record.bookId;
}

/** Store a user-uploaded PDF or (DRM-free) EPUB as a ready-to-read book. */
export async function ingestUpload(
  file: File,
  title: string,
  author: string,
  onStatus: (status: string) => void,
): Promise<string> {
  if (file.size > 50 * 1024 * 1024) {
    throw new IngestError("That file is over 50MB — try a smaller one.");
  }
  const isEpub =
    /\.epub$/i.test(file.name) || file.type === "application/epub+zip";

  let pdfBytes: ArrayBuffer;
  let bookTitle = title || file.name.replace(/\.(pdf|epub)$/i, "");
  let bookAuthor = author;

  if (isEpub) {
    onStatus("Opening your ebook…");
    const raw = await file.arrayBuffer();
    let extracted;
    try {
      extracted = epubToText(raw);
    } catch (e) {
      throw new IngestError(
        e instanceof EpubError ? e.message : "Couldn't read this EPUB file.",
      );
    }
    bookTitle = title || extracted.title || bookTitle;
    bookAuthor = author || extracted.author || "";
    onStatus("Turning your ebook into clean pages…");
    const pdf = await textToPdf(extracted.text, bookTitle, bookAuthor);
    pdfBytes = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;
  } else {
    onStatus("Reading your PDF…");
    pdfBytes = await file.arrayBuffer();
  }

  const pageCount = await assertTextLayer(pdfBytes);
  const record: BookRecord = {
    bookId: crypto.randomUUID(),
    title: bookTitle,
    author: bookAuthor,
    provider: "upload",
    createdAt: Date.now(),
    pageCount,
    generatedPdf: isEpub,
  };
  await saveBook(record, pdfBytes);
  return record.bookId;
}
