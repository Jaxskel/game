/**
 * Full ingest-pipeline test against the LIVE deployment: fetch the real book
 * text through the deployed proxy, then run the same text→PDF conversion and
 * text-layer check the browser performs. Catches real-text edge cases
 * (encoding, layout) that synthetic fixtures miss.
 */
import { textToPdf } from "../lib/pdf/textToPdf";

const BASE = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

// Books with different formats/character sets: a play, 19th-century prose
// with curly quotes, and a long novel with unusual punctuation.
const BOOKS: [string, string, string][] = [
  ["1513", "Romeo and Juliet", "William Shakespeare"],
  ["1342", "Pride and Prejudice", "Jane Austen"],
  ["2701", "Moby Dick", "Herman Melville"],
];

async function testBook(id: string, title: string, author: string) {
  const bookUrl = `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;
  const res = await fetch(
    `${BASE}/api/fetch-book?url=${encodeURIComponent(bookUrl)}`,
    { signal: AbortSignal.timeout(90_000) },
  );
  if (!res.ok) {
    console.log(`❌ ${title}: fetch failed ${res.status}`);
    return false;
  }
  const text = await res.text();

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await textToPdf(text, title, author);
  } catch (e) {
    console.log(`❌ ${title}: textToPdf threw: ${e instanceof Error ? e.message : e}`);
    return false;
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
  const page3 = await doc.getPage(3);
  const content = await page3.getTextContent();
  const pageText = content.items
    .map((i) => ("str" in i ? (i as { str: string }).str : ""))
    .join(" ");
  const pages = doc.numPages;
  await doc.loadingTask.destroy();
  const ok = pages >= 20 && pageText.replace(/\s+/g, "").length >= 40;
  console.log(
    `${ok ? "✅" : "❌"} ${title}: ${text.length} chars → ${pages} pages, text layer ${ok ? "OK" : "MISSING"}`,
  );
  return ok;
}

async function main() {
  let failures = 0;
  for (const [id, title, author] of BOOKS) {
    if (!(await testBook(id, title, author))) failures++;
  }
  if (failures > 0) {
    console.log(`${failures} BOOK(S) FAILED INGEST`);
    process.exit(1);
  }
  console.log("FULL INGEST PIPELINE OK on all sample books");
}

main().catch((e) => {
  console.error("UNCAUGHT:", e);
  process.exit(1);
});
