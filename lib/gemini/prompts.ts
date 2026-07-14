export const OCR_PROMPT = `Each image is a photo of one or more pages from a printed book. Transcribe the body text EXACTLY as printed — every word, all punctuation, in natural reading order.
- If the image shows an OPEN BOOK with two pages side by side, transcribe the LEFT page completely first, then the RIGHT page. Put a blank line between the two pages.
- Preserve paragraph breaks as blank lines. For poetry/verse, preserve line breaks.
- Skip page numbers, running headers/footers, and anything that isn't body text.
- If part is blurry or unreadable, transcribe what you can and continue.
Return one entry per image, in the same order as the images.`;

export const YOUTUBE_PROMPT = `This YouTube video presents a book — either read ALOUD (an audiobook) or SHOWN on screen (pages/text). Transcribe the book's actual text as accurately and completely as you can, in reading order.
- If it's narrated, transcribe the spoken words verbatim.
- If pages/text are shown on screen, read and transcribe them.
- Preserve paragraph breaks as blank lines; for poetry/verse, preserve line breaks.
- Ignore intros, sponsorships, channel chatter, and outros — only the book text.
Output only the transcribed book text, no commentary.`;

export const IDENTIFY_PROMPT = `You are looking at a photo of a book (usually its cover, possibly a spine or title page).
Identify the book. Return:
- identified: true only if you can read or confidently recognize a real published book
- title and author: the canonical published title and author name
- confidence: 0-1, how sure you are
- alternates: up to 3 other plausible matches if you are not certain
If the photo is not a book or is unreadable, set identified=false and confidence=0.`;

export function analyzePrompt(title: string, author: string, scope: string) {
  return `You are an expert literature teacher preparing study notes on "${title}" by ${author}.
${scope}
Produce a thorough but student-friendly analysis:
- summary: 2-3 paragraphs covering the whole arc
- setting: time period, place, and a short description of the world
- characters: every main and notable supporting character with role and a 1-2 sentence description
- plotPoints: 6-12 key events in order, each tagged with its plot stage
- conflict: the central conflict type (e.g. "character vs. society") and description
- themes: 3-6 major themes with explanations
- figurativeLanguage: 4-8 notable examples (metaphor, simile, personification, symbolism...) with the quoted example text and what it means

IF THE TEXT IS NONFICTION (a textbook, essay collection, history, civics or science book), adapt each field sensibly instead of forcing a story structure:
- characters = the key people, groups, or institutions discussed (role: protagonist for central figures, supporting for others)
- plotPoints = the main ideas/sections in the order presented (use stages loosely: exposition = foundations, climax = the most important concept)
- conflict = the central question, debate, or tension the book addresses
- themes = the big takeaways a student should remember
- figurativeLanguage = notable vocabulary, definitions, or vivid examples worth memorizing
Base everything strictly on the provided text.`;
}

export const ANALYZE_FULL_SCOPE = "The complete text of the book follows.";
export function analyzeChunkScope(i: number, n: number) {
  return `This is part ${i + 1} of ${n} of the book's text. Analyze ONLY what is present in this part; partial views of characters/plot are expected.`;
}
export const ANALYZE_REDUCE_SCOPE =
  "You are given several partial analyses (JSON) of consecutive parts of the book, produced separately. Merge them into ONE coherent whole-book analysis, deduplicating characters and themes and ordering plot points correctly.";

export function annotatePrompt(
  title: string,
  author: string,
  context: { characters: string[]; themes: string[] },
) {
  return `You are annotating pages of "${title}" by ${author} the way a careful student marks up a physical book with highlighters and a pen.

Known main characters: ${context.characters.join(", ") || "unknown"}.
Known themes: ${context.themes.join(", ") || "unknown"}.

For EACH page of text provided (each is labeled with its page number), select 2-6 passages worth highlighting. For each:
- exact_quote: a VERBATIM substring of that page's text, 3-25 words. Copy it character-for-character, including punctuation. Never paraphrase, never join text across gaps.
- category: setting | character | figurative_language | conflict_event | theme
- margin_note: what a student would write in the margin, max 12 words, plain and insightful.
  For figurative_language, NAME the device and what it does, e.g. "Metaphor - Juliet compared to the sun" or "Personification - the sea 'mutters'".
  For other categories, say what the passage establishes or why it matters.
- importance: 3 = essential, 2 = notable, 1 = nice detail
- page: the page number the quote came from

Rules:
- Quotes MUST appear character-for-character in that page's provided text.
- Skip pages that are front matter, tables of contents, or license text (return no annotations for them).
- Prefer variety across categories when the page allows it.
- IF THE PAGE IS NONFICTION (textbook, history, civics, science), map the categories sensibly:
  setting = context/background facts (dates, places, circumstances);
  character = key people, groups, or institutions;
  figurative_language = key vocabulary, definitions, or vivid examples;
  conflict_event = important events, turning points, or debated issues;
  theme = main ideas a student must remember.
  Margin notes should read like study notes ("Definition: ...", "Key date", "Main idea of this section").`;
}
