import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeBookText } from "@/lib/gemini/client";
import { geminiErrorResponse } from "@/lib/apiError";

export const maxDuration = 60;

const bodyZ = z.object({
  title: z.string().min(1),
  author: z.string(),
  mode: z.enum(["full", "chunk", "reduce"]),
  text: z.string().max(4_000_000).optional(),
  chunkIndex: z.number().int().min(0).optional(),
  chunkCount: z.number().int().min(1).optional(),
  partials: z.array(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: parsed.error.message } },
      { status: 400 },
    );
  }
  const { mode, text, partials } = parsed.data;
  if ((mode === "full" || mode === "chunk") && !text) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "text required for this mode" } },
      { status: 400 },
    );
  }
  if (mode === "reduce" && !partials?.length) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "partials required for reduce" } },
      { status: 400 },
    );
  }
  try {
    const analysis = await analyzeBookText(parsed.data);
    return NextResponse.json({ analysis });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
