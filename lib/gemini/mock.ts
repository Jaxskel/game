import type { Annotation, BookAnalysis, CategoryKey, IdentifyResult } from "@/lib/types";

/**
 * Deterministic fixtures for MOCK_GEMINI=1 (e2e tests / dev without a key).
 * mockAnnotate picks real substrings of the supplied page text so highlights
 * genuinely render through the matcher, exactly like production output.
 */

export function mockIdentify(): IdentifyResult {
  return {
    identified: true,
    title: "Romeo and Juliet",
    author: "William Shakespeare",
    confidence: 0.95,
    alternates: [],
  };
}

export function mockAnalysis(title: string, author: string): BookAnalysis {
  return {
    summary: `${title} by ${author} — mock analysis. Two young lovers from feuding families meet, marry in secret, and are destroyed by the hatred surrounding them, teaching both houses the cost of their feud.`,
    setting: {
      time: "The 14th century, over four days in high summer",
      place: "Verona and Mantua, Italy",
      description:
        "A hot, honor-obsessed city where two noble houses feud in the streets.",
    },
    characters: [
      { name: "Romeo Montague", role: "protagonist", description: "Impulsive young Montague who falls for Juliet at first sight." },
      { name: "Juliet Capulet", role: "protagonist", description: "Thirteen-year-old Capulet whose love for Romeo defies her family." },
      { name: "Tybalt", role: "antagonist", description: "Juliet's hot-headed cousin whose duel sets the tragedy in motion." },
      { name: "Friar Laurence", role: "supporting", description: "Well-meaning priest whose schemes go fatally wrong." },
      { name: "Mercutio", role: "supporting", description: "Romeo's witty friend, slain by Tybalt." },
    ],
    plotPoints: [
      { label: "The feud", description: "Montagues and Capulets brawl in Verona's streets.", stage: "exposition" },
      { label: "The masquerade", description: "Romeo and Juliet meet and fall in love.", stage: "rising_action" },
      { label: "Secret marriage", description: "Friar Laurence weds the lovers in secret.", stage: "rising_action" },
      { label: "Mercutio and Tybalt die", description: "Romeo kills Tybalt and is banished.", stage: "climax" },
      { label: "The potion plan", description: "Juliet fakes death; the message to Romeo goes astray.", stage: "falling_action" },
      { label: "The tomb", description: "Both lovers die; the families reconcile.", stage: "resolution" },
    ],
    conflict: {
      type: "character vs. society",
      description: "The lovers' devotion collides with their families' ancient feud.",
    },
    themes: [
      { theme: "Love vs. hate", explanation: "Love blooms inside, and is destroyed by, inherited hatred." },
      { theme: "Fate", explanation: "The 'star-cross'd' lovers seem doomed from the prologue." },
      { theme: "Haste", explanation: "Impulsive choices — marriage, duels, poison — drive the tragedy." },
    ],
    figurativeLanguage: [
      { device: "Metaphor", example: "It is the east, and Juliet is the sun.", explanation: "Juliet as the sun: light, warmth, and a new day." },
      { device: "Foreshadowing", example: "A pair of star-cross'd lovers take their life", explanation: "The prologue announces the ending before it begins." },
      { device: "Oxymoron", example: "O brawling love! O loving hate!", explanation: "Contradictions mirror the feud-tangled love." },
    ],
  };
}

const MOCK_CATEGORIES: CategoryKey[] = [
  "setting",
  "character",
  "figurative_language",
  "conflict_event",
  "theme",
];

const MOCK_NOTES: Record<CategoryKey, string> = {
  setting: "Establishes where and when this happens",
  character: "Notice how this reveals character",
  figurative_language: "Simile - the sea sounds like an old man dreaming",
  conflict_event: "Key moment of conflict",
  theme: "Connects to a major theme",
};

/** Pick a clean span of `words` words starting near `fromWord`. */
function pickSpan(words: string[], fromWord: number, count: number): string | null {
  const slice = words.slice(fromWord, fromWord + count);
  if (slice.length < Math.min(4, count)) return null;
  return slice.join(" ");
}

export function mockAnnotate(
  pages: { page: number; text: string }[],
): Annotation[] {
  const out: Annotation[] = [];
  for (const { page, text } of pages) {
    const words = text.replace(/\s+/g, " ").trim().split(" ");
    if (words.length < 30) continue;
    const positions = [
      Math.floor(words.length * 0.05),
      Math.floor(words.length * 0.4),
      Math.floor(words.length * 0.75),
    ];
    positions.forEach((pos, i) => {
      const quote = pickSpan(words, pos, 8);
      if (!quote) return;
      const category = MOCK_CATEGORIES[(page + i) % MOCK_CATEGORIES.length];
      out.push({
        page,
        exact_quote: quote,
        category,
        margin_note: MOCK_NOTES[category],
        importance: ((page + i) % 3) + 1,
      });
    });
  }
  return out;
}
