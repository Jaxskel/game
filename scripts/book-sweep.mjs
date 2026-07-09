/**
 * Multi-book sweep against the live deployment: for each classic, verify the
 * app can find it and download its full text. No Gemini calls — cheap to run.
 */
const base = (process.env.LIVE_URL ?? "https://book-annatatir.vercel.app").replace(/\/$/, "");

const BOOKS = [
  ["Romeo and Juliet", "Shakespeare"],
  ["The Great Gatsby", "Fitzgerald"],
  ["Frankenstein", "Mary Shelley"],
  ["Pride and Prejudice", "Jane Austen"],
  ["Moby Dick", "Herman Melville"],
  ["A Christmas Carol", "Charles Dickens"],
  ["Dracula", "Bram Stoker"],
  ["The Call of the Wild", "Jack London"],
  ["The Adventures of Tom Sawyer", "Mark Twain"],
  ["Little Women", "Louisa May Alcott"],
];

let failures = 0;
for (const [title, author] of BOOKS) {
  try {
    const s = await fetch(
      `${base}/api/search-book?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    const sources = (await s.json()).sources ?? [];
    const gut = sources.find((x) => x.provider === "gutenberg");
    if (!gut) {
      console.log(`❌ ${title} — no Gutenberg source (${sources.length} total)`);
      failures++;
      continue;
    }
    const f = await fetch(
      `${base}/api/fetch-book?url=${encodeURIComponent(gut.downloadUrl)}`,
      { signal: AbortSignal.timeout(90_000) },
    );
    if (!f.ok || !f.body) {
      console.log(`❌ ${title} — download ${f.status}`);
      failures++;
      continue;
    }
    let size = 0;
    const reader = f.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
    }
    const ok = size > 50_000;
    console.log(`${ok ? "✅" : "❌"} ${title} — ${gut.title} (#${gut.id}), ${Math.round(size / 1024)}KB`);
    if (!ok) failures++;
  } catch (e) {
    console.log(`❌ ${title} — ${e.message}`);
    failures++;
  }
}

console.log(
  failures === 0 ? `\n🎉 ALL ${BOOKS.length} BOOKS DOWNLOADABLE` : `\n${failures}/${BOOKS.length} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
