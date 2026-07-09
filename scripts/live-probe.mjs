/**
 * Full live-deployment verification: exercises every API of the deployed app
 * including the real-Gemini endpoints. Run from a network that can reach
 * Vercel (GitHub Actions). Base URL via LIVE_URL or default.
 */
const base = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

// Valid 1x1 PNG — enough to verify the identify endpoint + Gemini key path.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let failures = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

console.log(`=== ${base} ===`);

// 1. App serves
const home = await fetch(base, { signal: AbortSignal.timeout(20_000) });
ok("app serves", home.status === 200, `status ${home.status}`);

// 2. Book search
const s = await fetch(
  `${base}/api/search-book?title=Romeo+and+Juliet&author=Shakespeare`,
  { signal: AbortSignal.timeout(30_000) },
);
const sData = await s.json().catch(() => ({}));
const sources = sData.sources ?? [];
ok(
  "book search finds Gutenberg",
  s.status === 200 && sources.some((x) => x.provider === "gutenberg"),
  `${sources.length} sources`,
);

// 3. Book download via proxy
const gut = sources.find((x) => x.provider === "gutenberg");
let bookText = "";
if (gut) {
  const f = await fetch(
    `${base}/api/fetch-book?url=${encodeURIComponent(gut.downloadUrl)}`,
    { signal: AbortSignal.timeout(60_000) },
  );
  bookText = f.ok ? await f.text() : "";
  ok("book download", f.status === 200 && bookText.length > 50_000, `${bookText.length} chars`);
} else {
  ok("book download", false, "no gutenberg source to download");
}

// 4. Whole-book analysis (real Gemini — uses a trimmed text to save quota)
const analyzeRes = await fetch(`${base}/api/analyze-book`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: "Romeo and Juliet",
    author: "William Shakespeare",
    mode: "full",
    text: bookText.slice(0, 80_000) || "But soft! What light through yonder window breaks?",
  }),
  signal: AbortSignal.timeout(120_000),
});
const analyzeData = await analyzeRes.json().catch(() => ({}));
const analysis = analyzeData.analysis;
ok(
  "Gemini whole-book analysis",
  analyzeRes.status === 200 &&
    Array.isArray(analysis?.characters) &&
    analysis.characters.length > 0 &&
    typeof analysis?.summary === "string",
  analyzeRes.status === 200
    ? `characters: ${analysis?.characters?.map((c) => c.name).slice(0, 4).join(", ")}`
    : `status ${analyzeRes.status}: ${JSON.stringify(analyzeData).slice(0, 200)}`,
);

// 5. Page annotation (real Gemini + verbatim-quote validation)
const samplePage = bookText.slice(20_000, 23_000) || "";
const annotateRes = await fetch(`${base}/api/annotate-pages`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    title: "Romeo and Juliet",
    author: "William Shakespeare",
    analysisContext: {
      characters: analysis?.characters?.map((c) => c.name).slice(0, 10) ?? ["Romeo", "Juliet"],
      themes: analysis?.themes?.map((t) => t.theme).slice(0, 5) ?? ["love"],
    },
    pages: [{ page: 5, text: samplePage }],
  }),
  signal: AbortSignal.timeout(120_000),
});
const annotateData = await annotateRes.json().catch(() => ({}));
const anns = annotateData.annotations ?? [];
const quotesVerbatim = anns.every((a) =>
  samplePage.toLowerCase().replace(/\s+/g, " ").includes(
    a.exact_quote.toLowerCase().replace(/\s+/g, " ").slice(0, 40),
  ),
);
ok(
  "Gemini page annotation (verbatim quotes)",
  annotateRes.status === 200 && anns.length > 0 && quotesVerbatim,
  annotateRes.status === 200
    ? `${anns.length} annotations, e.g. [${anns[0]?.category}] "${anns[0]?.exact_quote?.slice(0, 50)}"`
    : `status ${annotateRes.status}: ${JSON.stringify(annotateData).slice(0, 200)}`,
);

// 6. Cover identification endpoint (tiny image — verifies key + vision path;
//    Gemini correctly reports it can't identify a 1x1 pixel)
const idRes = await fetch(`${base}/api/identify-book`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ imageBase64: TINY_PNG, mimeType: "image/png" }),
  signal: AbortSignal.timeout(60_000),
});
const idData = await idRes.json().catch(() => ({}));
ok(
  "cover identify endpoint",
  idRes.status === 200 && typeof idData.identified === "boolean",
  `status ${idRes.status}, identified=${idData.identified}`,
);

console.log(failures === 0 ? "\n🎉 ALL LIVE FEATURES VERIFIED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
