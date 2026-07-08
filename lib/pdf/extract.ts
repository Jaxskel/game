import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { ExtractedItem, ExtractedPage } from "@/lib/types";

/**
 * Extract text items with PDF-user-space positions from one page.
 * Positions: x/y from the text matrix (y = baseline), w = advance width,
 * h = font height. Works without rendering (no canvas needed).
 */
export async function extractPage(
  pdfPage: PDFPageProxy,
  pageNumber: number,
): Promise<ExtractedPage> {
  const content = await pdfPage.getTextContent();
  const items: ExtractedItem[] = [];
  const textParts: string[] = [];

  for (const raw of content.items) {
    const item = raw as TextItem;
    if (typeof item.str !== "string") continue;
    if (item.str.length === 0 && !item.hasEOL) continue;
    const h = item.height || Math.abs(item.transform[3]) || 10;
    items.push({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      w: item.width,
      h,
      hasEOL: Boolean(item.hasEOL),
    });
    textParts.push(item.str);
    if (item.hasEOL) textParts.push("\n");
  }

  return { page: pageNumber, text: textParts.join(" "), items };
}

export async function extractAllPages(
  doc: PDFDocumentProxy,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(await extractPage(page, i));
    onProgress?.(i, doc.numPages);
  }
  return pages;
}

/** True if the page has enough real text to run the annotation pipeline. */
export function pageHasTextLayer(page: ExtractedPage): boolean {
  return page.text.replace(/\s+/g, "").length > 40;
}
