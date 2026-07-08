import type { BookSourceCandidate } from "./types";

/**
 * Deterministic synthetic "book" used when MOCK_BOOKS=1 (e2e tests / local
 * dev in sandboxes where gutenberg.org and archive.org are unreachable).
 * Original prose — long enough to paginate into several pages.
 */

export function mockBooksMode(): boolean {
  return process.env.MOCK_BOOKS === "1";
}

export const FIXTURE_URL = "https://www.gutenberg.org/fixture/mock-book.txt";

export function fixtureSource(title: string, author: string): BookSourceCandidate {
  return {
    provider: "gutenberg",
    id: "fixture-1",
    title: title || "The Lantern Keeper",
    author: author || "A. Storyteller",
    format: "text",
    downloadUrl: FIXTURE_URL,
  };
}

export function fixtureBookText(): string {
  const chapters: string[] = [];
  const romanNumerals = ["I", "II", "III", "IV"];
  for (let c = 0; c < 4; c++) {
    const paras: string[] = [`CHAPTER ${romanNumerals[c]}`];
    for (let p = 0; p < 10; p++) {
      paras.push(
        `The village of Bellwater sat at the edge of a cold grey sea, and in chapter ${c + 1} the lantern keeper climbed the spiral stairs for the ${p + 1}th time that week. ` +
          `Mara counted the steps out of habit, the way her mother had taught her, and the sea below muttered like an old man dreaming. ` +
          `The light was a promise, she thought; a small stubborn sun that refused the storm. ` +
          `Far out on the water a fishing boat leaned into the wind, and the feud between the harbor families felt very small from this height. ` +
          `Still, trouble was coming to Bellwater, as certain as the tide.`,
      );
    }
    chapters.push(paras.join("\n\n"));
  }
  return [
    "*** START OF THE PROJECT GUTENBERG EBOOK THE LANTERN KEEPER ***",
    ...chapters,
    "*** END OF THE PROJECT GUTENBERG EBOOK THE LANTERN KEEPER ***",
  ].join("\n\n");
}
