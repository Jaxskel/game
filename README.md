# 📚 Book Annotator

Snap a photo of a book — get a full literary analysis and a page-by-page,
highlighter-annotated PDF you can copy straight into your physical copy.

## What it does

1. **📷 Snap** — photograph the book's cover (or type the title). Gemini
   identifies the book.
2. **📥 Fetch** — the app finds a free public-domain copy (Project Gutenberg /
   Internet Archive) and turns it into a clean, paginated PDF — or you upload
   your own PDF of the exact edition you own.
3. **🧠 Analyze** — Gemini reads the whole book and produces a study dashboard:
   summary, setting, main characters, plot arc, central conflict, themes, and
   figurative-language examples.
4. **🖍 Annotate** — every page is shown with color-coded highlights drawn on
   the exact words (word-for-word verbatim quotes, verified server-side), plus
   margin notes in large readable text:
   - 🟩 Setting · 🟨 Character · 🩷 Figurative language · 🟧 Conflict / key
     event · 🟦 Theme
5. **⬇ Export** — download the annotated PDF (highlights + margin notes +
   study-guide cover page baked in) and copy the markings into your real book
   with a highlighter and pen.

## Running locally

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev
```

Get a Gemini API key at <https://aistudio.google.com/apikey>. Without a key you
can still develop against canned fixtures: set `MOCK_GEMINI=1` (and
`MOCK_BOOKS=1` to skip the real Gutenberg/Archive network calls).

## Deploying to Vercel

Deploy the repo, then set the `GEMINI_API_KEY` environment variable
(Production + Preview) in the Vercel project settings and redeploy. The key is
only ever used server-side.

## Testing

```bash
npm test          # unit tests (quote→highlight matcher, PDF generation)
npm run test:e2e  # Playwright end-to-end (mock LLM + fixture book)
```

## Architecture notes

- **All heavy PDF work happens in the browser** (pdf.js rendering, text
  extraction, quote→coordinate matching, pdf-lib export). API routes are thin
  stateless proxies for Gemini calls, book search, and CORS-safe downloads.
- Books and analysis results are cached in the browser (IndexedDB) — nothing
  is stored on a server.
- The LLM returns *verbatim quotes*; a fuzzy matcher locates them among the
  pdf.js text items and computes highlight rectangles in PDF user space. A
  quote that can't be located confidently degrades to a margin-note-only
  annotation — never a misplaced highlight.
- Each page is annotated by the LLM exactly once (lazily, as you read) and
  cached, keeping cost low. Requests are serialized with backoff to respect
  API rate limits.

## Known limitations

- **Page numbers**: a Gutenberg-generated PDF won't match your printed
  edition page-for-page. Margin notes carry the quoted words and chapter
  headings so passages are findable; uploading a PDF of your exact edition
  gives exact positional fidelity.
- **Scanned PDFs** without a selectable text layer are detected and rejected
  (OCR is not supported yet).
- Only public-domain books are fetched automatically; for anything else,
  upload your own copy.
