import { unzipSync } from "fflate";

/**
 * Minimal EPUB → plain text extractor (DRM-free EPUBs only). An EPUB is a
 * zip: META-INF/container.xml points at an OPF manifest whose <spine> lists
 * the reading-order (X)HTML documents. We extract those and strip markup.
 * Regex-based so it runs in both browser and Node (tests).
 */

export class EpubError extends Error {}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&rdquo;": "”",
  "&ldquo;": "“",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ");
}

/** Convert one (X)HTML document to text with paragraph breaks. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(head|style|script|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Block-level boundaries become paragraph breaks…
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|section|article)>/gi, "\n\n")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      // …then drop every remaining tag.
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function getFile(
  files: Record<string, Uint8Array>,
  path: string,
): string | null {
  // Zip paths are case-sensitive in theory; be forgiving in practice.
  const key =
    path in files
      ? path
      : Object.keys(files).find((k) => k.toLowerCase() === path.toLowerCase());
  if (!key) return null;
  return new TextDecoder("utf-8").decode(files[key]);
}

export function epubToText(bytes: ArrayBuffer | Uint8Array): {
  text: string;
  title: string | null;
  author: string | null;
} {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } catch {
    throw new EpubError(
      "Couldn't open this EPUB. If it was bought from Kindle or Apple Books it's DRM-locked — those can't be opened by any outside app.",
    );
  }

  const container = getFile(files, "META-INF/container.xml");
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath ? getFile(files, opfPath) : null;
  if (!opfPath || !opf) {
    throw new EpubError("This EPUB is missing its table of contents (OPF).");
  }
  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";

  const title =
    opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? null;
  const author =
    opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() ?? null;

  // manifest: id → href
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) manifest.set(id, href);
  }

  // spine: reading order of manifest ids
  const spineIds = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/gi)].map(
    (m) => m[1],
  );

  const chunks: string[] = [];
  for (const id of spineIds) {
    const href = manifest.get(id);
    if (!href) continue;
    const doc = getFile(files, decodeURIComponent(opfDir + href).replace(/#.*$/, ""));
    if (!doc) continue;
    const text = htmlToText(doc);
    if (text.length > 40) chunks.push(text);
  }

  const text = chunks.join("\n\n");
  if (text.length < 1000) {
    throw new EpubError(
      "Couldn't read enough text from this EPUB — it may be image-based or DRM-locked.",
    );
  }
  return {
    text,
    title: title ? htmlToText(title) : null,
    author: author ? htmlToText(author) : null,
  };
}
