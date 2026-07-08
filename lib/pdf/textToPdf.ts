import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Lay out plain text (e.g., from Project Gutenberg) as a clean paginated PDF
 * with a wide right margin reserved for margin notes. The output feeds the
 * same pdf.js extract→match pipeline as uploaded PDFs (one code path).
 */

const PAGE_W = 612; // Letter
const PAGE_H = 792;
const MARGIN_LEFT = 54;
const MARGIN_RIGHT = 190; // reserved gutter for margin notes
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 56;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;
const HEADING_SIZE = 15;

export const TEXT_WIDTH = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT;
export const GUTTER_X = PAGE_W - MARGIN_RIGHT + 10;

/** Strip the Project Gutenberg license header/footer if present. */
export function stripGutenbergBoilerplate(text: string): string {
  const start = text.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i);
  const end = text.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i);
  let out = text;
  if (end && end.index !== undefined) out = out.slice(0, end.index);
  if (start && start.index !== undefined)
    out = out.slice(start.index + start[0].length);
  return out.trim();
}

const UNICODE_FALLBACK: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'",
  "“": '"', "”": '"', "„": '"',
  "–": "-", "—": "--", "…": "...",
  " ": " ", "ﬁ": "fi", "ﬂ": "fl",
};

/** Make text safe for pdf-lib's WinAnsi-encoded standard fonts. */
function sanitize(s: string): string {
  let out = "";
  for (const c of s) {
    if (UNICODE_FALLBACK[c] !== undefined) {
      out += UNICODE_FALLBACK[c];
    } else if (c.charCodeAt(0) < 0x100 && c !== "\t") {
      out += c;
    } else {
      const d = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += d.charCodeAt(0) < 0x100 ? d : "?";
    }
  }
  return out;
}

const CHAPTER_RE =
  /^\s*(CHAPTER|Chapter|ACT|SCENE|BOOK|PART|STAVE|LETTER|PROLOGUE|EPILOGUE|CANTO)\b[^a-z]*$|^\s*[IVXLC]+\.?\s*$/;

interface Block {
  kind: "heading" | "paragraph";
  text: string;
}

/** Re-flow hard-wrapped Gutenberg text into headings and paragraphs. */
export function textToBlocks(raw: string): Block[] {
  const text = stripGutenbergBoilerplate(raw).replace(/\r\n/g, "\n");
  const chunks = text.split(/\n\s*\n+/);
  const blocks: Block[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    if (lines.length <= 2 && CHAPTER_RE.test(lines[0]) && lines[0].length < 60) {
      blocks.push({ kind: "heading", text: sanitize(lines.join(" — ")) });
      continue;
    }
    blocks.push({
      kind: "paragraph",
      text: sanitize(lines.join(" ").replace(/\s+/g, " ")),
    });
  }
  return blocks;
}

export async function textToPdf(
  rawText: string,
  title: string,
  author: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const gray = rgb(0.45, 0.45, 0.45);
  const black = rgb(0.1, 0.1, 0.1);
  const header = sanitize(`${title} — ${author}`).slice(0, 90);

  const blocks = textToBlocks(rawText);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let pageNo = 1;
  let y = PAGE_H - MARGIN_TOP;

  const drawChrome = () => {
    page.drawText(header, {
      x: MARGIN_LEFT,
      y: PAGE_H - 36,
      size: 8,
      font,
      color: gray,
    });
    page.drawText(String(pageNo), {
      x: MARGIN_LEFT + TEXT_WIDTH / 2,
      y: 30,
      size: 9,
      font,
      color: gray,
    });
  };
  drawChrome();

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageNo += 1;
    y = PAGE_H - MARGIN_TOP;
    drawChrome();
  };

  const wrap = (text: string, f: typeof font, size: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(candidate, size) <= TEXT_WIDTH) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        // Hard-break pathological long words.
        let w = word;
        while (f.widthOfTextAtSize(w, size) > TEXT_WIDTH) {
          let cut = w.length - 1;
          while (cut > 1 && f.widthOfTextAtSize(w.slice(0, cut), size) > TEXT_WIDTH) cut--;
          lines.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  for (const block of blocks) {
    const isHeading = block.kind === "heading";
    const f = isHeading ? bold : font;
    const size = isHeading ? HEADING_SIZE : FONT_SIZE;
    const lines = wrap(block.text, f, size);
    if (isHeading && y < PAGE_H - MARGIN_TOP) {
      y -= LINE_HEIGHT; // extra space above headings
    }
    for (const line of lines) {
      if (y < MARGIN_BOTTOM + LINE_HEIGHT) newPage();
      page.drawText(line, { x: MARGIN_LEFT, y, size, font: f, color: black });
      y -= isHeading ? LINE_HEIGHT + 4 : LINE_HEIGHT;
    }
    y -= isHeading ? 8 : LINE_HEIGHT * 0.45; // paragraph spacing
  }

  return doc.save();
}
