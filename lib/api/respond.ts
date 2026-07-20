import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Stable error object shape for every API error. */
export interface ApiError {
  error: { code: string; message: string };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, {
    ...init,
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      ...init?.headers,
    },
  });
}

export function err(code: string, message: string, status: number): NextResponse {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status });
}

/** Parse URL search params against a zod schema; returns data or a 400 response. */
export function parseQuery<T>(
  url: string,
  schema: ZodType<T>,
): { data: T; response: null } | { data: null; response: NextResponse } {
  const params = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      data: null,
      response: err(
        "invalid_query",
        `${issue?.path.join(".") || "query"}: ${issue?.message ?? "invalid"}`,
        400,
      ),
    };
  }
  return { data: result.data, response: null };
}
