import { describe, expect, it } from "vitest";
import {
  buildPageStream,
  locateQuote,
  matchQuote,
  normalizeQuote,
} from "@/lib/pdf/match";
import type { ExtractedItem } from "@/lib/types";

/** Build a fake single-line item at a given baseline. */
function item(str: string, x: number, y: number, hasEOL = false): ExtractedItem {
  return { str, x, y, w: str.length * 5, h: 10, hasEOL };
}

describe("normalizeQuote", () => {
  it("unifies curly quotes, dashes, ligatures and case", () => {
    expect(normalizeQuote("It’s “ﬁne” — really")).toBe(`it's "fine" - really`);
  });
  it("collapses whitespace", () => {
    expect(normalizeQuote("a  b\n\tc")).toBe("a b c");
  });
});

describe("locateQuote", () => {
  it("finds an exact quote inside one item", () => {
    const stream = buildPageStream([item("The quick brown fox jumps", 10, 700)]);
    const range = locateQuote(stream, "quick brown fox");
    expect(range).not.toBeNull();
    expect(stream.norm.slice(range!.start, range!.end)).toBe("quick brown fox");
  });

  it("finds a quote spanning three items", () => {
    const stream = buildPageStream([
      item("It is the east,", 10, 700),
      item("and Juliet", 90, 700),
      item("is the sun.", 150, 700),
    ]);
    const range = locateQuote(stream, "the east, and Juliet is the sun");
    expect(range).not.toBeNull();
  });

  it("finds a quote across a line break", () => {
    const stream = buildPageStream([
      item("But soft! What light through", 10, 700, true),
      item("yonder window breaks?", 10, 684),
    ]);
    const range = locateQuote(stream, "light through yonder window");
    expect(range).not.toBeNull();
  });

  it("matches despite curly-quote/dash mismatches", () => {
    const stream = buildPageStream([item("‘Tis but thy name — that is my enemy", 10, 700)]);
    const range = locateQuote(stream, "'Tis but thy name - that is my enemy");
    expect(range).not.toBeNull();
    expect(range!.start).toBe(0);
  });

  it("fuzzy-matches a slightly off quote", () => {
    const stream = buildPageStream([
      item("Two households, both alike in dignity, in fair Verona where we lay our scene", 10, 700),
    ]);
    // "dignitie" misspelled + missing comma
    const range = locateQuote(stream, "both alike in dignitie in fair Verona");
    expect(range).not.toBeNull();
  });

  it("returns null for text not on the page", () => {
    const stream = buildPageStream([item("Call me Ishmael.", 10, 700)]);
    expect(locateQuote(stream, "It was the best of times")).toBeNull();
  });
});

describe("matchQuote → rects", () => {
  it("produces one merged rect per line", () => {
    const items = [
      item("But soft! What light through", 10, 700, true),
      item("yonder window breaks?", 10, 684),
    ];
    const rects = matchQuote(items, "What light through yonder window");
    expect(rects.length).toBe(2); // one per line
    const [top, bottom] = rects;
    expect(top.y).toBeGreaterThan(bottom.y);
  });

  it("covers a partial slice of a single item", () => {
    const items = [item("The quick brown fox jumps over the lazy dog", 100, 500)];
    const rects = matchQuote(items, "brown fox");
    expect(rects.length).toBe(1);
    const r = rects[0];
    expect(r.x).toBeGreaterThan(100); // starts after "The quick "
    expect(r.w).toBeLessThan(items[0].w); // narrower than the whole line
    expect(r.x + r.w).toBeLessThan(100 + items[0].w);
  });

  it("returns no rects for unfound quotes (margin-note-only fallback)", () => {
    const items = [item("Call me Ishmael.", 10, 700)];
    expect(matchQuote(items, "completely different text here")).toEqual([]);
  });

  it("merges multiple items on the same baseline into one rect", () => {
    const items = [
      item("It is the east,", 10, 700),
      item("and Juliet is the sun.", 95, 700),
    ];
    const rects = matchQuote(items, "the east, and Juliet");
    expect(rects.length).toBe(1);
  });
});
