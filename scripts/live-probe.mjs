/**
 * Probe the deployed app's own API endpoints from a network that can reach
 * Vercel (GitHub Actions). Pass the base URL via LIVE_URL, or the default
 * candidate list is tried.
 */
const bases = process.env.LIVE_URL
  ? [process.env.LIVE_URL.replace(/\/$/, "")]
  : ["https://book-annatatir.vercel.app"];

for (const base of bases) {
  console.log(`\n=== ${base} ===`);
  try {
    const home = await fetch(base, { signal: AbortSignal.timeout(20_000) });
    console.log(`GET / → ${home.status} ${home.headers.get("content-type")}`);

    const s = await fetch(
      `${base}/api/search-book?title=Romeo+and+Juliet&author=Shakespeare`,
      { signal: AbortSignal.timeout(30_000) },
    );
    const sBody = await s.text();
    console.log(`GET /api/search-book → ${s.status}`);
    console.log(`  body: ${sBody.slice(0, 600)}`);
    if (!s.ok) continue;

    const sources = JSON.parse(sBody).sources ?? [];
    const first = sources[0];
    if (!first) {
      console.log("  NO SOURCES RETURNED");
      continue;
    }
    const f = await fetch(
      `${base}/api/fetch-book?url=${encodeURIComponent(first.downloadUrl)}`,
      { signal: AbortSignal.timeout(60_000) },
    );
    console.log(
      `GET /api/fetch-book (${first.provider} ${first.id}) → ${f.status} ${f.headers.get("content-type")}`,
    );
    if (f.ok && f.body) {
      const reader = f.body.getReader();
      let size = 0;
      let head = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size === 0)
          head = new TextDecoder("utf-8", { fatal: false }).decode(
            value.slice(0, 200),
          );
        size += value.byteLength;
        if (size > 2_000_000) {
          await reader.cancel();
          break;
        }
      }
      console.log(`  bytes>=${size}; head: ${head.replace(/\s+/g, " ").slice(0, 120)}`);
    } else {
      console.log(`  error body: ${(await f.text()).slice(0, 400)}`);
    }
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
}
