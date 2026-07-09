import { describe, expect, it } from "vitest";
import { epubToText, htmlToText, EpubError } from "@/lib/epub";
import { makeEpub } from "../fixtures/makeEpub";

describe("htmlToText", () => {
  it("strips tags, keeps paragraph breaks, decodes entities", () => {
    const text = htmlToText(
      "<head><style>p{color:red}</style></head><body><h1>Title</h1><p>One &amp; two.</p><p>Three&hellip;</p></body>",
    );
    expect(text).toContain("Title");
    expect(text).toContain("One & two.");
    expect(text).toContain("Three…");
    expect(text).not.toContain("color:red");
    expect(text.split("\n\n").length).toBeGreaterThanOrEqual(2);
  });
});

describe("epubToText", () => {
  it("extracts spine text and metadata from a real zip structure", () => {
    const { text, title, author } = epubToText(makeEpub());
    expect(title).toBe("The Lantern Keeper");
    expect(author).toBe("A. Storyteller");
    expect(text).toContain("CHAPTER I");
    expect(text).toContain("CHAPTER II");
    expect(text).toContain('the sea said “hello”');
    expect(text.length).toBeGreaterThan(5000);
  });

  it("throws a friendly error on garbage bytes", () => {
    expect(() => epubToText(new Uint8Array([1, 2, 3, 4]))).toThrow(EpubError);
  });
});
