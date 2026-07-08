import type { BookSourceCandidate } from "./types";

interface ArchiveDoc {
  identifier: string;
  title?: string;
  creator?: string | string[];
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
    `&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&rows=5&page=1&output=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    response?: { docs?: ArchiveDoc[] };
  };
  return (data.response?.docs ?? []).map((doc) => ({
    provider: "archive" as const,
    id: doc.identifier,
    title: doc.title ?? title,
    author: Array.isArray(doc.creator)
      ? doc.creator.join(", ")
      : (doc.creator ?? author ?? "Unknown"),
    format: "pdf" as const,
    downloadUrl: `https://archive.org/download/${doc.identifier}/${doc.identifier}.pdf`,
    mayLackTextLayer: true,
  }));
}
