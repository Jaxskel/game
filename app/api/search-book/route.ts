import { NextRequest, NextResponse } from "next/server";
import { searchGutenberg } from "@/lib/gutendex";
import { searchArchive } from "@/lib/archive";
import { fixtureSource, mockBooksMode } from "@/lib/fixtureBook";
import type { BookSourceCandidate } from "@/lib/types";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim() ?? "";
  const author = req.nextUrl.searchParams.get("author")?.trim() ?? "";
  if (!title) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "title is required" } },
      { status: 400 },
    );
  }

  if (mockBooksMode()) {
    return NextResponse.json({ sources: [fixtureSource(title, author)] });
  }

  const [gutenberg, archive] = await Promise.allSettled([
    searchGutenberg(title, author),
    searchArchive(title, author),
  ]);

  const sources: BookSourceCandidate[] = [
    ...(gutenberg.status === "fulfilled" ? gutenberg.value : []),
    ...(archive.status === "fulfilled" ? archive.value : []),
  ];

  return NextResponse.json({ sources });
}
