/**
 * Smoke-test the book download pipeline from a datacenter IP (GitHub Actions).
 * Mirrors the exact request behavior of app/api/fetch-book/route.ts so we can
 * see what gutenberg.org / archive.org actually return to cloud hosts.
 */

const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
};

async function probe(label, url, { headBytes = 2048 } = {}) {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    let size = 0;
    let head = "";
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size < headBytes) {
          head += new TextDecoder("utf-8", { fatal: false }).decode(
            value.slice(0, headBytes - size),
          );
        }
        size += value.byteLength;
        if (size > 3_000_000) {
          await reader.cancel();
          break;
        }
      }
    }
    console.log(
      `[${label}] ${res.status} ${res.headers.get("content-type")} bytes>=${size} final=${res.url}`,
    );
    if (res.status !== 200) console.log(`  body head: ${head.slice(0, 300).replace(/\n/g, " ")}`);
    return { status: res.status, size, head };
  } catch (e) {
    console.log(`[${label}] ERROR ${e.message}`);
    return { status: 0, size: 0, head: "" };
  }
}

let failures = 0;

// 1. Gutendex search
const search = await probe(
  "gutendex-search",
  "https://gutendex.com/books?search=romeo%20and%20juliet%20shakespeare",
);
let textUrl = "https://www.gutenberg.org/ebooks/1513.txt.utf-8";
try {
  const data = JSON.parse(search.head);
  const first = data.results?.[0];
  const key = Object.keys(first?.formats ?? {}).find((k) => k.startsWith("text/plain"));
  if (key) textUrl = first.formats[key];
  console.log(`  picked text url: ${textUrl}`);
} catch {
  console.log("  (could not parse search head; using default 1513 url)");
}
if (search.status !== 200) failures++;

// 2. Gutenberg text: primary + fallbacks
const gutCandidates = [
  textUrl,
  "https://www.gutenberg.org/cache/epub/1513/pg1513.txt.utf8",
  "https://www.gutenberg.org/files/1513/1513-0.txt",
  "https://gutenberg.pglaf.org/cache/epub/1513/pg1513.txt.utf8",
];
let gutOk = false;
for (const u of gutCandidates) {
  const r = await probe(`gutenberg ${u}`, u);
  if (r.status === 200 && r.size > 10_000) {
    gutOk = true;
    break;
  }
}
if (!gutOk) failures++;

// 3. Archive: search → metadata → real pdf file
const q = encodeURIComponent('title:("Romeo and Juliet") AND mediatype:texts');
const adv = await probe(
  "archive-search",
  `https://archive.org/advancedsearch.php?q=${q}&fl%5B%5D=identifier&rows=3&page=1&output=json`,
  { headBytes: 4096 },
);
let identifier = null;
try {
  identifier = JSON.parse(adv.head).response?.docs?.[0]?.identifier ?? null;
} catch {
  /* head may be truncated JSON */
}
if (!identifier) {
  console.log("  no identifier parsed; using known item 'romeojuliet00shak_2'");
  identifier = "romeojuliet00shak_2";
}
const mdRes = await fetch(`https://archive.org/metadata/${identifier}`, {
  headers: FETCH_HEADERS,
  signal: AbortSignal.timeout(20_000),
});
console.log(`[archive-metadata ${identifier}] ${mdRes.status}`);
if (mdRes.ok) {
  const md = await mdRes.json();
  const pdf = (md.files ?? []).find(
    (f) => /\.pdf$/i.test(f.name) && (f.format ?? "").toLowerCase().includes("pdf"),
  );
  console.log(`  pdf file: ${pdf?.name ?? "NONE"} (${pdf?.size ?? "?"} bytes)`);
  if (pdf) {
    const r = await probe(
      "archive-pdf",
      `https://archive.org/download/${identifier}/${encodeURIComponent(pdf.name)}`,
      { headBytes: 8 },
    );
    if (!(r.status === 200 && r.size > 1000)) failures++;
  }
} else {
  failures++;
}

console.log(failures === 0 ? "\nALL DOWNLOAD PATHS OK" : `\n${failures} PATH(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
