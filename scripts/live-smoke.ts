/**
 * Live smoke test of the real search/download pipeline from a datacenter IP
 * (GitHub Actions) — imports the actual lib code the app runs.
 */
import { searchGutenberg } from "../lib/gutendex";
import { searchArchive } from "../lib/archive";

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "*/*",
};

let failures = 0;

const gutenberg = await searchGutenberg("Romeo and Juliet", "Shakespeare");
console.log(
  "gutenberg sources:",
  gutenberg.map((s) => `${s.id} ${s.title} → ${s.downloadUrl}`),
);
if (gutenberg.length === 0) {
  console.log("FAIL: no gutenberg sources found");
  failures++;
} else {
  const res = await fetch(gutenberg[0].downloadUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(30_000),
  });
  const text = res.ok ? await res.text() : "";
  console.log(`gutenberg download: ${res.status}, ${text.length} chars`);
  if (!(res.ok && text.length > 50_000)) {
    console.log("FAIL: gutenberg text download broken");
    failures++;
  }
}

const archive = await searchArchive("Romeo and Juliet", "Shakespeare");
console.log(
  "archive sources:",
  archive.map((s) => `${s.id} → ${s.downloadUrl}`),
);
for (const s of archive) {
  const res = await fetch(s.downloadUrl, {
    headers: { ...HEADERS, range: "bytes=0-99" },
    signal: AbortSignal.timeout(20_000),
  });
  console.log(`archive ranged download ${s.id}: ${res.status}`);
  res.body?.cancel();
  if (res.status !== 200 && res.status !== 206) {
    console.log("FAIL: offered archive source does not download");
    failures++;
  }
}

console.log(failures === 0 ? "ALL OK" : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
