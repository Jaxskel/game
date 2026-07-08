import type { BookSourceCandidate } from "./types";

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
}

interface ArchiveFile {
  name: string;
  format?: string;
  size?: string | number;
}

const UA = { "user-agent": "Mozilla/5.0 (compatible; BookAnnotator/1.0)" };
const MAX_PDF_BYTES = 24 * 1024 * 1024; // stay under the fetch proxy's cap

/**
 * Look up the item's real file list — Archive PDFs are rarely named
 * `{identifier}.pdf`, so guessing URLs 404s. Returns null when the item has
 * no usable, unrestricted PDF.
 */
async function findPdfFile(identifier: string): Promise<ArchiveFile | null> {
  const res = await fetch(`https://archive.org/metadata/${identifier}`, {
    headers: UA,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const md = (await res.json()) as {
    is_dark?: boolean;
    metadata?: Record<string, unknown>;
    files?: ArchiveFile[];
  };
  if (md.is_dark) return null;
  const restricted = md.metadata?.["access-restricted-item"];
  if (restricted === "true" || restricted === true) return null;
  // Lending-library items 401 on download even when they look public.
  const collections = ([] as unknown[]).concat(md.metadata?.collection ?? []);
  if (collections.some((c) => c === "inlibrary" || c === "printdisabled")) {
    return null;
  }

  const pdfs = (md.files ?? []).filter(
    (f) =>
      /\.pdf$/i.test(f.name) &&
      !/_encrypted|_bw\.pdf$/i.test(f.name) &&
      (f.format ?? "").toLowerCase().includes("pdf"),
  );
  // Prefer "Text PDF" (has an OCR text layer), then smallest usable file.
  pdfs.sort((a, b) => {
    const aText = (a.format ?? "").toLowerCase() === "text pdf" ? 0 : 1;
    const bText = (b.format ?? "").toLowerCase() === "text pdf" ? 0 : 1;
    if (aText !== bText) return aText - bText;
    return Number(a.size ?? Infinity) - Number(b.size ?? Infinity);
  });
  const pick = pdfs.find((f) => Number(f.size ?? 0) <= MAX_PDF_BYTES);
  if (!pick) return null;

  // Verify the file actually downloads (restricted items 401/403 here).
  const check = await fetch(
    `https://archive.org/download/${identifier}/${encodeURIComponent(pick.name)}`,
    {
      headers: { ...UA, range: "bytes=0-0" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (check.status !== 200 && check.status !== 206) return null;
  check.body?.cancel();
  return pick;
}

export async function searchArchive(
  title: string,
  author: string,
): Promise<BookSourceCandidate[]> {
  const parts = [`title:("${title}")`, "mediatype:texts"];
  if (author) parts.splice(1, 0, `creator:("${author}")`);
  const q = encodeURIComponent(parts.join(" AND "));
  const url =
    `https://archive.org/advancedsearch.php?q=${q}` +
    `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=6&page=1&output=json`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    response?: { docs?: ArchiveDoc[] };
  };
  const docs = data.response?.docs ?? [];

  // Resolve real PDF filenames for the top hits (skip items without one).
  const resolved = await Promise.allSettled(
    docs.slice(0, 4).map(async (doc): Promise<BookSourceCandidate | null> => {
      const pdf = await findPdfFile(doc.identifier);
      if (!pdf) return null;
      return {
        provider: "archive" as const,
        id: doc.identifier,
        title: doc.title ?? title,
        author: Array.isArray(doc.creator)
          ? doc.creator.join(", ")
          : (doc.creator ?? author ?? "Unknown"),
        format: "pdf" as const,
        downloadUrl: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(pdf.name)}`,
        mayLackTextLayer: true,
      };
    }),
  );
  return resolved
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is BookSourceCandidate => v !== null)
    .slice(0, 3);
}
