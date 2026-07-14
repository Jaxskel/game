import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transcribeYouTube } from "@/lib/gemini/client";
import { geminiErrorResponse } from "@/lib/apiError";

export const maxDuration = 60;

const bodyZ = z.object({ url: z.string().url() });

function isYouTube(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return (
      h === "youtube.com" ||
      h === "m.youtube.com" ||
      h === "youtu.be" ||
      h === "youtube-nocookie.com"
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const parsed = bodyZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !isYouTube(parsed.data.url)) {
    return NextResponse.json(
      { error: { code: "bad_request", message: "A valid YouTube URL is required." } },
      { status: 400 },
    );
  }
  try {
    const text = await transcribeYouTube(parsed.data.url);
    return NextResponse.json({ text });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
