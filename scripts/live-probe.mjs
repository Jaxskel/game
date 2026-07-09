/**
 * Full live-deployment verification: exercises every API of the deployed app
 * including the real-Gemini endpoints. Run from a network that can reach
 * Vercel (GitHub Actions). Base URL via LIVE_URL or default.
 */
const base = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

// Small valid PNG (64x96 mock cover) — verifies the identify endpoint + Gemini vision path.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABgCAYAAACtxXToAAAD10lEQVR4AeyVS0gVURjH/2fm3p72zt4l9H4tKmpRELWoNkGt2kVQRA9aiUGQZQ8z0DIheoCLNtGiNoVQCbUzBCOIwBQzqSxKr6ZFavmYmb6ZqxMaw2WaE3rO/YY758583znf/b7/9zvnGgs2FTnpfBtI84sFSHMAwAQwAWmuAG+BNAeAD8HALdBQUAqd7iDSAwUIWqCbnQXQraNh62ECwiqm+vyh+TMBQxX513cxfRtim1/CWHoexpLTMJcXAhmrkuGMsWQ7C3NlCX2fgbn6OsSUjUkfjcbcfWS7kfStKIYxdy9ZAT/m/ANwLzFxHWLry2jtJvdVyi2NAKf1KWB1wv5wE3Z9PpzOepgLDnpJGvP2QYyeAasmm3znYNWegLk0HxibBTFxDYz5+8l2vN+XAzFtK8TM3fBjJh4DJKKYtRt9r/bDaa/04soYpAnwVzLxKXB+vPbMYtoW2C3l3rM3WB1wvr+AMWOn12W77RmJ1+W53MFOlMOYuct9TN4iDpOost9dBXq/Jm2SRukCGFlHYS67ADFhJezWJ16agsRAT6v3PDA4PVTIqEyI+FQqqm3AnPzuSUCMmp58ptHMOgyRuR1i3EJ6k/uRLoC7Bay6U7BqchBbdxegIr1iY5MGZS7i9N7dDKenBYhNGORDnOjpTvg26+MtWG8v0hlyGXAF8z3RH4zoIQIi9LaTQwDChN1cBiNzB/zLzPD2vp14lPRN3gCY43y3O9dufuC/w+qC03QfzrfnJMKVP3YJT9IEcE9smOPhbgFj8Uk61ekw/HQb6G6C8+UenI5aSr6k/6QvhEUHJX41Al0NsBqKYK641O8rhtNWCSfxEH7M2XuoVAGrLg9izBzaYgUkWAbZon+kCeCe2H0Va2G/yYNNuFrVR+gf4Zqfod1YStsiG3Y9/QtUH6NuVvk+p60CFtk8X20O7M93PJ8f8z0dfnAA+yf6qnaQELkAHaTepIiDNAEi5jFsy1mAYZN+hPwwEzBCGjFsaQQSsCj3EHS6gxQOFCBogWr2VPmyAKkU0t3PBOje4VT1MQGpFNLdzwTo3uFU9TEBqRTS3c8E6N7hVPUxAakU0t3PBOjW4bD1MAFhFdNtPhOgW0fD1sMEhFVMt/lMgG4dDVsPExBWMd3mMwG6dTRsPUxAWMV0m88EqN7RqPkzAVEVVH09E6B6B6PmzwREVVD19UyA6h2Mmj8TEFVB1dczAap3MGr+TEBUBVVfzwSo1kHZ+TIBshVVLR4ToFrHZOfLBMhWVLV4TIBqHZOdLxMgW1HV4jEBqnVMdr5MgGxFVYvHBIz0jv3v/H4DAAD//3Er5g8AAAAGSURBVAMAxhb5ECUmT+YAAAAASUVORK5CYII=";

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
