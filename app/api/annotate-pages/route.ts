import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { annotatePages } from "@/lib/gemini/client";
import { geminiErrorResponse } from "@/lib/apiError";
import { normalizeQuote } from "@/lib/pdf/match";

export const maxDuration = 60;

const bodyZ = z.object({
  title: z.string().min(1),
  author: z.string(),
  analysisContext: z.object({
    characters: z.array(z.string()).max(30),
    themes: z.array(z.string()).max(15),
  }),
  pages: z
    .array(z.object({ page: z.number().int().min(1), text: z.string().max(20_000) }))
    .min(1)
    .max(5),
});

export async function POST(req: NextRequest) {
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: parsed.error.message } },
      { status: 400 },
    );
  }
  try {
    const annotations = await annotatePages(parsed.data);
    // Defense against hallucinated quotes: every quote must actually appear
    // (normalized) in the page text it claims to come from.
    const pageNorm = new Map(
      parsed.data.pages.map((p) => [p.page, normalizeQuote(p.text)]),
    );
    const valid = annotations.filter((a) => {
      const norm = pageNorm.get(a.page);
      return norm !== undefined && norm.includes(normalizeQuote(a.exact_quote));
    });
    return NextResponse.json({ annotations: valid });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
