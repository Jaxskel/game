import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ocrPageImages } from "@/lib/gemini/client";
import { geminiErrorResponse } from "@/lib/apiError";

export const maxDuration = 60;

const bodyZ = z.object({
  images: z
    .array(
      z.object({
        base64: z.string().min(100),
        mimeType: z.string().regex(/^image\//),
      }),
    )
    .min(1)
    .max(4),
});

export async function POST(req: NextRequest) {
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "images[] required (max 4 per call)" } },
      { status: 400 },
    );
  }
  try {
    const pages = await ocrPageImages(parsed.data.images);
    return NextResponse.json({ pages });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
