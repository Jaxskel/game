/**
 * Confirm the LATEST features are actually in the live deployment's served
 * JavaScript (i.e. the newest commit built + deployed on Vercel). Run from a
 * network that can reach the site (GitHub Actions).
 */
const base = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

let failures = 0;
const ok = (name, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

const home = await fetch(base + "/", { signal: AbortSignal.timeout(20_000) });
const html = await home.text();
ok("homepage serves", home.status === 200, `status ${home.status}`);

// Collect all static JS chunks referenced by the homepage.
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/[^"']+\.js/g)].map((m) => m[0]))];
console.log(`  ${chunks.length} JS chunks referenced`);

let bundle = "";
for (const c of chunks) {
  try {
    const r = await fetch(base + c, { signal: AbortSignal.timeout(20_000) });
    if (r.ok) bundle += await r.text();
  } catch {
    /* skip a failed chunk */
  }
}

// Markers unique to each feature's committed source.
ok("video mode deployed", bundle.includes("page-video-input"), "record-a-page-flip-video UI");
ok("snap-pages deployed", bundle.includes("build-from-photos"), "photograph-pages UI");
ok("EPUB upload deployed", /epub/i.test(bundle), "epub accept");
ok(
  "iPhone video fix deployed",
  bundle.includes("You can also snap photos of the pages instead"),
  "robust-seek + playback-kick build",
);

console.log(
  failures === 0
    ? "\n🎉 LATEST BUILD (through iPhone video fix) IS LIVE ON VERCEL"
    : `\n${failures} MARKER(S) MISSING — newest commit may not be deployed`,
);
process.exit(failures === 0 ? 0 : 1);
