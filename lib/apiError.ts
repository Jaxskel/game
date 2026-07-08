import { NextResponse } from "next/server";
import { GeminiError } from "./gemini/client";

export function geminiErrorResponse(err: unknown) {
  if (err instanceof GeminiError) {
    const status =
      err.code === "rate_limited" ? 429 : err.code === "missing_key" ? 503 : 502;
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status },
    );
  }
  const message = err instanceof Error ? err.message : "unexpected error";
  return NextResponse.json(
    { error: { code: "internal", message } },
    { status: 500 },
  );
}
