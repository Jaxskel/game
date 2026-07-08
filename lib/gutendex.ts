import type { BookSourceCandidate } from "./types";

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

/** Pick the best plain-text format URL from a Gutendex formats map. */
function pickTextUrl(formats: Record<string, string>): string | null {
  const keys = Object.keys(formats);
  const utf8 = keys.find((k) => k.startsWith("text/plain") && k.includes("utf-8"));
  if (utf8) return formats[utf8];
  const anyPlain = keys.find(
    (k) => k.startsWith("text/plain") && !formats[k].endsWith(".zip"),
  );
  return anyPlain ? formats[anyPlain] : null;
}

export async function searchGutenberg(
  title: string,
  author: string,
): Promise<BookSourceCandidate[]> {
  const q = encodeURIComponent(`${title} ${author}`.trim());
  const res = await fetch(`https://gutendex.com/books?search=${q}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GutendexBook[] };
  const out: BookSourceCandidate[] = [];
  for (const book of data.results ?? []) {
    const url = pickTextUrl(book.formats ?? {});
    if (!url) continue;
    out.push({
      provider: "gutenberg",
      id: String(book.id),
      title: book.title,
      author: book.authors?.map((a) => a.name).join(", ") || "Unknown",
      format: "text",
      downloadUrl: url,
    });
    if (out.length >= 5) break;
  }
  return out;
}
