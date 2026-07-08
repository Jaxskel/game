/**
 * Full ingest-pipeline test against the LIVE deployment: fetch the real book
 * text through the deployed proxy, then run the same text→PDF conversion and
 * text-layer check the browser performs. Catches real-text edge cases
 * (encoding, layout) that synthetic fixtures miss.
 */
import { textToPdf } from "../lib/pdf/textToPdf";

const BASE = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

async function main() {
  const bookUrl = "https://www.gutenberg.org/ebooks/1513.txt.utf-8";
  console.log("fetching real book text via live proxy…");
  const res = await fetch(
    `${BASE}/api/fetch-book?url=${encodeURIComponent(bookUrl)}`,
    { signal: AbortSignal.timeout(60_000) },
  );
  if (!res.ok) {
    console.log(`FETCH FAILED: ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const text = await res.text();
  console.log(`got ${text.length} chars`);

  console.log("running textToPdf on the real text…");
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await textToPdf(text, "Romeo and Juliet", "William Shakespeare");
  } catch (e) {
    console.log(`TEXT-TO-PDF THREW: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  console.log(`pdf bytes: ${pdfBytes.byteLength}`);

  console.log("extracting text layer with pdf.js…");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
  console.log(`pages: ${doc.numPages}`);
  const page3 = await doc.getPage(3);
  const content = await page3.getTextContent();
  const pageText = content.items
    .map((i) => ("str" in i ? (i as { str: string }).str : ""))
    .join(" ");
  console.log(`page 3 text head: ${pageText.slice(0, 120)}`);
  await doc.loadingTask.destroy();
  if (doc.numPages < 20 || pageText.replace(/\s+/g, "").length < 40) {
    console.log("FAIL: pdf too small or text layer missing");
    process.exit(1);
  }
  console.log("FULL INGEST PIPELINE OK on real book text");
}

main().catch((e) => {
  console.error("UNCAUGHT:", e);
  process.exit(1);
});
