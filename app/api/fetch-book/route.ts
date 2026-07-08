import { NextRequest, NextResponse } from "next/server";
import { FIXTURE_URL, fixtureBookText, mockBooksMode } from "@/lib/fixtureBook";

export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function hostAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const h = url.hostname;
  return (
    h === "gutenberg.org" ||
    h === "www.gutenberg.org" ||
    h === "gutendex.com" ||
    h === "archive.org" ||
    h.endsWith(".archive.org")
  );
}

/**
 * CORS/byte proxy for book downloads. Follows redirects manually so every
 * hop stays inside the host allowlist.
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

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!hostAllowed(url)) {
      return NextResponse.json(
        { error: { code: "forbidden", message: `host not allowed: ${url.hostname}` } },
        { status: 403 },
      );
    }
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(50_000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url);
      res = null;
      continue;
    }
    break;
  }

  if (!res || !res.ok || !res.body) {
    return NextResponse.json(
      {
        error: {
          code: "upstream_error",
          message: `upstream returned ${res?.status ?? "no response"}`,
        },
      },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const upstream = res.body;
  let total = 0;
  const capped = upstream.pipeThrough(
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
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
