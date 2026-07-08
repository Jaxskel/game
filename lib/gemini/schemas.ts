import { z } from "zod";
import { Type, type Schema } from "@google/genai";
import { CATEGORY_KEYS } from "@/lib/categories";

// ---------- identify-book ----------

export const identifyResultZ = z.object({
  identified: z.boolean(),
  title: z.string(),
  author: z.string(),
  confidence: z.number().min(0).max(1),
  alternates: z
    .array(z.object({ title: z.string(), author: z.string() }))
    .optional(),
});

export const identifyResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    identified: { type: Type.BOOLEAN },
    title: { type: Type.STRING },
    author: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    alternates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          author: { type: Type.STRING },
        },
        required: ["title", "author"],
      },
    },
  },
  required: ["identified", "title", "author", "confidence"],
};

// ---------- analyze-book ----------

export const analysisZ = z.object({
  summary: z.string(),
  setting: z.object({
    time: z.string(),
    place: z.string(),
    description: z.string(),
  }),
  characters: z.array(
    z.object({
      name: z.string(),
      role: z.enum(["protagonist", "antagonist", "supporting", "minor"]),
      description: z.string(),
    }),
  ),
  plotPoints: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      stage: z.enum([
        "exposition",
        "rising_action",
        "climax",
        "falling_action",
        "resolution",
      ]),
    }),
  ),
  conflict: z.object({ type: z.string(), description: z.string() }),
  themes: z.array(z.object({ theme: z.string(), explanation: z.string() })),
  figurativeLanguage: z
    .array(
      z.object({
        device: z.string(),
        example: z.string(),
        explanation: z.string(),
      }),
    )
    .default([]),
});

export const analysisResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    setting: {
      type: Type.OBJECT,
      properties: {
        time: { type: Type.STRING },
        place: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["time", "place", "description"],
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: {
            type: Type.STRING,
            enum: ["protagonist", "antagonist", "supporting", "minor"],
          },
          description: { type: Type.STRING },
        },
        required: ["name", "role", "description"],
      },
    },
    plotPoints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          description: { type: Type.STRING },
          stage: {
            type: Type.STRING,
            enum: [
              "exposition",
              "rising_action",
              "climax",
              "falling_action",
              "resolution",
            ],
          },
        },
        required: ["label", "description", "stage"],
      },
    },
    conflict: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["type", "description"],
    },
    themes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["theme", "explanation"],
      },
    },
    figurativeLanguage: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          device: { type: Type.STRING },
          example: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["device", "example", "explanation"],
      },
    },
  },
  required: [
    "summary",
    "setting",
    "characters",
    "plotPoints",
    "conflict",
    "themes",
  ],
};

// ---------- annotate-pages ----------

export const annotationsZ = z.object({
  annotations: z.array(
    z.object({
      page: z.number().int(),
      exact_quote: z.string().min(3),
      category: z.enum(CATEGORY_KEYS as [string, ...string[]]),
      margin_note: z.string().min(1),
      importance: z.number().int().min(1).max(3),
    }),
  ),
});

export const annotationsResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    annotations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.INTEGER },
          exact_quote: { type: Type.STRING },
          category: { type: Type.STRING, enum: [...CATEGORY_KEYS] },
          margin_note: { type: Type.STRING },
          importance: { type: Type.INTEGER },
        },
        required: ["page", "exact_quote", "category", "margin_note", "importance"],
      },
    },
  },
  required: ["annotations"],
};
