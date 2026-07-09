import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_URL, fixtureBookText, mockBooksMode } from "@/lib/fixtureBook";

export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// Browser-style headers: gutenberg.org rejects botty datacenter requests
// with default fetch user agents.
const FETCH_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
};

function hostAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const h = url.hostname;
  return (
    h === "gutenberg.org" ||
    h === "www.gutenberg.org" ||
    h === "gutenberg.pglaf.org" ||
    h === "aleph.gutenberg.org" ||
    h === "gutendex.com" ||
    h === "archive.org" ||
    h.endsWith(".archive.org")
  );
}

/** Alternate locations for a Gutenberg text when the main site blocks us. */
function gutenbergFallbacks(url: URL): string[] {
  if (!/(^|\.)gutenberg\.org$/.test(url.hostname)) return [];
  const m = url.pathname.match(/(\d{3,7})/);
  if (!m) return [];
  const id = m[1];
  return [
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt.utf8`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt.utf8`,
  ].filter((u) => u !== url.toString());
}

/** Fetch one URL, following redirects manually so every hop stays allowlisted. */
async function fetchAllowlisted(
  start: URL,
): Promise<{ res: Response } | { error: string; status: number }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol === "http:") url.protocol = "https:"; // upgrade, never follow plain http
    if (!hostAllowed(url)) {
      return { error: `host not allowed: ${url.hostname}`, status: 403 };
    }
    let res: Response;
    try {
      res = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(45_000),
      });
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "network error",
        status: 502,
      };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { error: "redirect without location", status: 502 };
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok || !res.body) {
      return { error: `upstream returned ${res.status}`, status: 502 };
    }
    return { res };
  }
  return { error: "too many redirects", status: 502 };
}

/**
 * CORS/byte proxy for book downloads, with mirror fallbacks for Project
 * Gutenberg (their main site rate-limits/blocks many cloud IPs).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "url is required" } },
      { status: 400 },
    );
  }

  if (mockBooksMode() && raw === FIXTURE_URL) {
    return new NextResponse(fixtureBookText(), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json(
      { error: { code: "bad_request", message: "invalid url" } },
      { status: 400 },
    );
  }

  const candidates = [url.toString(), ...gutenbergFallbacks(url)];
  let lastError = { error: "no candidates", status: 502 };
  let ok: Response | null = null;
  for (const candidate of candidates) {
    const attempt = await fetchAllowlisted(new URL(candidate));
    if ("res" in attempt) {
      ok = attempt.res;
      break;
    }
    lastError = attempt;
    if (attempt.status === 403) break; // our own allowlist — retrying won't help
  }

  if (!ok?.body) {
    return NextResponse.json(
      { error: { code: "upstream_error", message: lastError.error } },
      { status: lastError.status },
    );
  }

  const contentType = ok.headers.get("content-type") ?? "application/octet-stream";
  let total = 0;
  const capped = ok.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > MAX_BYTES) {
          controller.error(new Error("file exceeds 25MB cap"));
        } else {
          controller.enqueue(chunk);
        }
      },
    }),
  );

  return new NextResponse(capped, {
    headers: {
      "content-type": contentType,
      // s-maxage → Vercel's CDN caches the book after the first download, so
      // repeat requests never hit gutenberg.org/archive.org again (and their
      // rate limits can't affect us).
      "cache-control": "public, max-age=3600, s-maxage=31536000, immutable",
    },
  });
}
