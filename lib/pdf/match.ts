import type { ExtractedItem, PdfRect } from "@/lib/types";

/**
 * Quote → highlight-rectangle matcher.
 *
 * The LLM returns verbatim quotes from a page's extracted text; this module
 * locates them among pdf.js text items and produces one merged rectangle per
 * text line, in PDF user space. If a quote can't be located confidently the
 * result is an empty rect list — the caller degrades to a margin-note-only
 * annotation, never a misplaced highlight.
 */

const CHAR_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "–": "-",
  "—": "-",
  "―": "-",
  "…": "...",
  "ﬁ": "fi",
  "ﬂ": "fl",
  " ": " ",
};

function normalizeChar(c: string): string {
  const mapped = CHAR_MAP[c];
  if (mapped !== undefined) return mapped;
  if (/\s/.test(c)) return " ";
  // Strip diacritics: é → e
  const decomposed = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return decomposed.toLowerCase();
}

/** Normalize a standalone string (no position tracking). */
export function normalizeQuote(s: string): string {
  let out = "";
  for (const c of s) {
    const n = normalizeChar(c);
    if (n === " " && (out.length === 0 || out.endsWith(" "))) continue;
    out += n;
  }
  return out.trimEnd();
}

interface CharOrigin {
  item: number; // index into items
  off: number; // char offset within items[item].str
}

export interface PageStream {
  norm: string;
  origins: CharOrigin[]; // origins[i] = source of norm[i]
  items: ExtractedItem[];
}

/** Concatenate items into one normalized stream with a char→item map. */
export function buildPageStream(items: ExtractedItem[]): PageStream {
  let norm = "";
  const origins: CharOrigin[] = [];

  const push = (s: string, origin: CharOrigin) => {
    for (const ch of s) {
      if (ch === " " && (norm.length === 0 || norm.endsWith(" "))) continue;
      norm += ch;
      origins.push(origin);
    }
  };

  items.forEach((item, i) => {
    const chars = [...item.str];
    chars.forEach((c, off) => push(normalizeChar(c), { item: i, off }));
    // pdf.js splits lines/words into arbitrary items; separate them.
    push(" ", { item: i, off: Math.max(0, chars.length - 1) });
  });

  while (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    origins.pop();
  }
  return { norm, origins, items };
}

/** Banded edit distance with early exit; returns Infinity if > maxDist. */
function boundedLevenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return Infinity;
  const band = maxDist;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const from = Math.max(1, i - band);
    const to = Math.min(b.length, i + band);
    if (from > 1) curr[from - 1] = Infinity;
    let rowMin = Infinity;
    for (let j = from; j <= to; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? Infinity) + 1,
        (curr[j - 1] ?? Infinity) + 1,
        (prev[j - 1] ?? Infinity) + cost,
      );
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDist) return Infinity;
    for (let j = to + 1; j <= b.length; j++) curr[j] = Infinity;
    [prev, curr] = [curr, prev];
  }
  const d = prev[b.length];
  return d <= maxDist ? d : Infinity;
}

/** Locate quoteNorm within stream.norm. Returns [start, end) or null. */
export function locateQuote(
  stream: PageStream,
  quote: string,
): { start: number; end: number } | null {
  const q = normalizeQuote(quote);
  if (q.length < 3) return null;
  const page = stream.norm;

  // 1. Exact match (usual case — the quote came from this very text).
  const exact = page.indexOf(q);
  if (exact !== -1) return { start: exact, end: exact + q.length };

  // 2. Fuzzy: anchor candidate windows on 8-char shingles from the quote,
  //    then score with bounded Levenshtein.
  const maxDist = Math.max(2, Math.floor(q.length * 0.2));
  const shingles: { text: string; offInQuote: number }[] = [];
  for (const frac of [0, 0.25, 0.5, 0.75]) {
    const off = Math.min(Math.floor(q.length * frac), Math.max(0, q.length - 8));
    const text = q.slice(off, off + 8);
    if (text.length === 8) shingles.push({ text, offInQuote: off });
  }

  let best: { start: number; end: number; dist: number } | null = null;
  const tried = new Set<number>();
  for (const { text, offInQuote } of shingles) {
    let idx = page.indexOf(text);
    while (idx !== -1) {
      const windowStart = Math.max(0, idx - offInQuote);
      if (!tried.has(windowStart)) {
        tried.add(windowStart);
        // Try a few window lengths around the quote length.
        for (const delta of [0, -Math.ceil(q.length * 0.1), Math.ceil(q.length * 0.1)]) {
          const len = q.length + delta;
          const candidate = page.slice(windowStart, windowStart + len);
          if (candidate.length < q.length * 0.7) continue;
          const dist = boundedLevenshtein(q, candidate, maxDist);
          if (dist !== Infinity && (!best || dist < best.dist)) {
            best = { start: windowStart, end: windowStart + candidate.length, dist };
          }
        }
      }
      idx = page.indexOf(text, idx + 1);
    }
  }
  return best ? { start: best.start, end: best.end } : null;
}

/** Convert a located norm-range into per-line merged highlight rects. */
export function rangeToRects(
  stream: PageStream,
  start: number,
  end: number,
): PdfRect[] {
  // Coverage per item: min/max original char offsets touched by the range.
  const coverage = new Map<number, { min: number; max: number }>();
  for (let i = start; i < end && i < stream.origins.length; i++) {
    const { item, off } = stream.origins[i];
    const c = coverage.get(item);
    if (!c) coverage.set(item, { min: off, max: off });
    else {
      c.min = Math.min(c.min, off);
      c.max = Math.max(c.max, off);
    }
  }

  const rects: PdfRect[] = [];
  for (const [itemIdx, c] of coverage) {
    const item = stream.items[itemIdx];
    const len = Math.max(1, [...item.str].length);
    const startFrac = c.min / len;
    const endFrac = Math.min(1, (c.max + 1) / len);
    if (endFrac <= startFrac) continue;
    rects.push({
      x: item.x + item.w * startFrac,
      y: item.y - 0.25 * item.h,
      w: item.w * (endFrac - startFrac),
      h: 1.2 * item.h,
    });
  }

  // Merge rects on the same text line (same baseline band) into one.
  rects.sort((a, b) => b.y - a.y || a.x - b.x);
  const merged: PdfRect[] = [];
  for (const r of rects) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - r.y) < 0.4 * Math.max(last.h, r.h)) {
      const x1 = Math.min(last.x, r.x);
      const x2 = Math.max(last.x + last.w, r.x + r.w);
      last.x = x1;
      last.w = x2 - x1;
      last.y = Math.min(last.y, r.y);
      last.h = Math.max(last.h, r.h);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

/** Full pipeline: quote → merged highlight rects (empty = not found). */
export function matchQuote(items: ExtractedItem[], quote: string): PdfRect[] {
  const stream = buildPageStream(items);
  const range = locateQuote(stream, quote);
  if (!range) return [];
  return rangeToRects(stream, range.start, range.end);
}
