import type { BookSourceCandidate } from "./types";

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

/** The cache/epub text URL — verified reachable from datacenter IPs. */
function gutenbergTextUrl(id: string | number): string {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt.utf8`;
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

async function searchViaGutendex(
  title: string,
  author: string,
): Promise<BookSourceCandidate[]> {
  const q = encodeURIComponent(`${title} ${author}`.trim());
  const res = await fetch(`https://gutendex.com/books?search=${q}`, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return []; // Cloudflare challenge page
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

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Fallback: search gutenberg.org directly (their site allows datacenter IPs
 * with browser headers, unlike Gutendex which sits behind a Cloudflare bot
 * wall). Parses the stable "booklink" markup of the search results page.
 */
async function searchViaGutenbergSite(
  title: string,
  author: string,
): Promise<BookSourceCandidate[]> {
  const q = encodeURIComponent(`${title} ${author}`.trim());
  const res = await fetch(
    `https://www.gutenberg.org/ebooks/search/?query=${q}&submit_search=Search`,
    { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) return [];
  const html = await res.text();
  const out: BookSourceCandidate[] = [];
  for (const m of html.matchAll(/<li class="booklink">([\s\S]*?)<\/li>/g)) {
    const block = m[1];
    const id = block.match(/href="\/ebooks\/(\d+)"/)?.[1];
    if (!id) continue;
    const bookTitle = block.match(/<span class="title">([^<]+)<\/span>/)?.[1];
    const bookAuthor = block.match(/<span class="subtitle">([^<]+)<\/span>/)?.[1];
    out.push({
      provider: "gutenberg",
      id,
      title: decodeEntities((bookTitle ?? title).trim()),
      author: decodeEntities((bookAuthor ?? author ?? "Unknown").trim()),
      format: "text",
      downloadUrl: gutenbergTextUrl(id),
    });
    if (out.length >= 5) break;
  }
  return out;
}

export async function searchGutenberg(
  title: string,
  author: string,
): Promise<BookSourceCandidate[]> {
  try {
    const viaApi = await searchViaGutendex(title, author);
    if (viaApi.length > 0) return viaApi;
  } catch {
    // fall through to site search
  }
  try {
    return await searchViaGutenbergSite(title, author);
  } catch {
    return [];
  }
}
