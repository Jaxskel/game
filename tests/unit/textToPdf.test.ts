import { describe, expect, it } from "vitest";
import {
  stripGutenbergBoilerplate,
  textToBlocks,
  textToPdf,
} from "@/lib/pdf/textToPdf";

const SAMPLE = `The Project Gutenberg eBook of Test Book

*** START OF THE PROJECT GUTENBERG EBOOK TEST BOOK ***

CHAPTER I

It was the best of times, it was the worst of times, it was the age of
wisdom, it was the age of foolishness, it was the epoch of belief, it was
the epoch of incredulity.

There were a king with a large jaw and a queen with a plain face, on the
throne of England.

*** END OF THE PROJECT GUTENBERG EBOOK TEST BOOK ***

License text that should be stripped.`;

describe("stripGutenbergBoilerplate", () => {
  it("removes header and footer", () => {
    const out = stripGutenbergBoilerplate(SAMPLE);
    expect(out).toContain("best of times");
    expect(out).not.toContain("Project Gutenberg eBook of Test Book");
    expect(out).not.toContain("License text");
  });
});

describe("textToBlocks", () => {
  it("detects chapter headings and re-flows paragraphs", () => {
    const blocks = textToBlocks(SAMPLE);
    expect(blocks[0]).toEqual({ kind: "heading", text: "CHAPTER I" });
    expect(blocks[1].kind).toBe("paragraph");
    // Hard-wrapped lines joined into one paragraph
    expect(blocks[1].text).toContain("the age of wisdom");
  });
});

describe("textToPdf", () => {
  it("produces a valid multi-block PDF with text extractable by pdf.js", async () => {
    const bytes = await textToPdf(SAMPLE, "Test Book", "Charles Dickens");
    expect(bytes.byteLength).toBeGreaterThan(1000);

    // Round-trip through pdf.js (legacy build works in Node) and confirm a
    // known line survives layout + extraction — the exact pipeline the
    // matcher runs on in the browser.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    expect(doc.numPages).toBeGreaterThanOrEqual(1);
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .map((i) => ("str" in i ? i.str : ""))
      .join(" ");
    expect(text).toContain("best of times");
    expect(text).toContain("CHAPTER I");
    await doc.loadingTask.destroy();
  });

  it("paginates long books", async () => {
    const longText = Array.from(
      { length: 300 },
      (_, i) => `Paragraph ${i}. ${"Lorem ipsum dolor sit amet. ".repeat(8)}`,
    ).join("\n\n");
    const bytes = await textToPdf(longText, "Long Book", "Nobody");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
    expect(doc.numPages).toBeGreaterThan(5);
    await doc.loadingTask.destroy();
  });
});
