import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { identifyBookFromImage } from "@/lib/gemini/client";
import { geminiErrorResponse } from "@/lib/apiError";

export const maxDuration = 60;

const bodyZ = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.string().regex(/^image\//),
});

export async function POST(req: NextRequest) {
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "imageBase64 and mimeType required" } },
      { status: 400 },
    );
  }
  try {
    const result = await identifyBookFromImage(
      parsed.data.imageBase64,
      parsed.data.mimeType,
    );
    return NextResponse.json(result);
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
