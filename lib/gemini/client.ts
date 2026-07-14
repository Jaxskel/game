import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";
import {
  analysisZ,
  analysisResponseSchema,
  annotationsZ,
  annotationsResponseSchema,
  identifyResultZ,
  identifyResponseSchema,
  ocrZ,
  ocrResponseSchema,
} from "./schemas";
import {
  ANALYZE_FULL_SCOPE,
  ANALYZE_REDUCE_SCOPE,
  IDENTIFY_PROMPT,
  OCR_PROMPT,
  YOUTUBE_PROMPT,
  analyzeChunkScope,
  analyzePrompt,
  annotatePrompt,
} from "./prompts";
import type { Annotation, BookAnalysis, IdentifyResult } from "@/lib/types";
import {
  mockAnalysis,
  mockAnnotate,
  mockIdentify,
  mockOcr,
  mockYouTube,
} from "./mock";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export function mockMode(): boolean {
  return process.env.MOCK_GEMINI === "1";
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "missing_key",
      "GEMINI_API_KEY is not configured on the server",
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export class GeminiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { fileUri: string; mimeType?: string } };

/** One plain-text generation call with retry/backoff on rate limits. */
async function generateText(parts: Part[]): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
      });
      const text = res.text;
      if (!text) throw new GeminiError("empty_response", "Gemini returned no text");
      return text;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /429|rate|quota|RESOURCE_EXHAUSTED|503|overloaded/i.test(msg);
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  if (lastErr instanceof GeminiError) throw lastErr;
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new GeminiError(
    /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? "rate_limited" : "gemini_error",
    msg,
  );
}

/** One structured-output call with retry/backoff on rate limits. */
async function generateJson(parts: Part[], schema: Schema): Promise<unknown> {
  // Keep total retry time well under the serverless function limit — the
  // client retries too, so err on the side of failing this request fast.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await ai().models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });
      const text = res.text;
      if (!text) throw new GeminiError("empty_response", "Gemini returned no text");
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /429|rate|quota|RESOURCE_EXHAUSTED|503|overloaded/i.test(msg);
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
  if (lastErr instanceof GeminiError) throw lastErr;
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new GeminiError(
    /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? "rate_limited" : "gemini_error",
    msg,
  );
}

export async function identifyBookFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<IdentifyResult> {
  if (mockMode()) return mockIdentify();
  const raw = await generateJson(
    [{ inlineData: { mimeType, data: imageBase64 } }, { text: IDENTIFY_PROMPT }],
    identifyResponseSchema,
  );
  return identifyResultZ.parse(raw) as IdentifyResult;
}

export async function ocrPageImages(
  images: { base64: string; mimeType: string }[],
): Promise<string[]> {
  if (mockMode()) return mockOcr(images.length);
  const raw = await generateJson(
    [
      ...images.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
      { text: OCR_PROMPT },
    ],
    ocrResponseSchema,
  );
  const parsed = ocrZ.parse(raw);
  return parsed.pages.map((p) => p.text);
}

/**
 * Transcribe a book from a YouTube video — audiobook (read aloud) or a
 * page/screen video (text shown). Gemini ingests the public URL directly.
 */
export async function transcribeYouTube(url: string): Promise<string> {
  if (mockMode()) return mockYouTube();
  return generateText([{ fileData: { fileUri: url } }, { text: YOUTUBE_PROMPT }]);
}

export async function analyzeBookText(args: {
  title: string;
  author: string;
  mode: "full" | "chunk" | "reduce";
  text?: string;
  chunkIndex?: number;
  chunkCount?: number;
  partials?: unknown[];
}): Promise<BookAnalysis> {
  if (mockMode()) return mockAnalysis(args.title, args.author);
  let scope: string;
  let body: string;
  if (args.mode === "reduce") {
    scope = ANALYZE_REDUCE_SCOPE;
    body = JSON.stringify(args.partials ?? []);
  } else if (args.mode === "chunk") {
    scope = analyzeChunkScope(args.chunkIndex ?? 0, args.chunkCount ?? 1);
    body = args.text ?? "";
  } else {
    scope = ANALYZE_FULL_SCOPE;
    body = args.text ?? "";
  }
  const raw = await generateJson(
    [{ text: analyzePrompt(args.title, args.author, scope) }, { text: body }],
    analysisResponseSchema,
  );
  return analysisZ.parse(raw) as BookAnalysis;
}

export async function annotatePages(args: {
  title: string;
  author: string;
  analysisContext: { characters: string[]; themes: string[] };
  pages: { page: number; text: string }[];
}): Promise<Annotation[]> {
  if (mockMode()) return mockAnnotate(args.pages);
  const pagesBlock = args.pages
    .map((p) => `=== PAGE ${p.page} ===\n${p.text}`)
    .join("\n\n");
  const raw = await generateJson(
    [
      { text: annotatePrompt(args.title, args.author, args.analysisContext) },
      { text: pagesBlock },
    ],
    annotationsResponseSchema,
  );
  const parsed = annotationsZ.safeParse(raw);
  if (!parsed.success) return [];
  return parsed.data.annotations as Annotation[];
}
