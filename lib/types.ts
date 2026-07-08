export type CategoryKey =
  | "setting"
  | "character"
  | "figurative_language"
  | "conflict_event"
  | "theme";

export type Provider = "gutenberg" | "archive" | "upload";

export interface BookSourceCandidate {
  provider: Exclude<Provider, "upload">;
  id: string;
  title: string;
  author: string;
  format: "text" | "pdf";
  downloadUrl: string;
  mayLackTextLayer?: boolean;
}

export interface BookRecord {
  bookId: string;
  title: string;
  author: string;
  provider: Provider;
  createdAt: number;
  pageCount: number;
}

export interface IdentifyResult {
  identified: boolean;
  title: string;
  author: string;
  confidence: number;
  alternates?: { title: string; author: string }[];
}

export interface Annotation {
  page: number;
  exact_quote: string;
  category: CategoryKey;
  margin_note: string;
  importance: number; // 1–3
}

export interface CharacterInfo {
  name: string;
  role: "protagonist" | "antagonist" | "supporting" | "minor";
  description: string;
}

export interface PlotPoint {
  label: string;
  description: string;
  stage:
    | "exposition"
    | "rising_action"
    | "climax"
    | "falling_action"
    | "resolution";
}

export interface BookAnalysis {
  summary: string;
  setting: { time: string; place: string; description: string };
  characters: CharacterInfo[];
  plotPoints: PlotPoint[];
  conflict: { type: string; description: string };
  themes: { theme: string; explanation: string }[];
  figurativeLanguage: {
    device: string;
    example: string;
    explanation: string;
  }[];
}

/** A rectangle in PDF user space (origin bottom-left, points). */
export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One text item extracted from a page, in PDF user space. */
export interface ExtractedItem {
  str: string;
  x: number;
  y: number; // baseline
  w: number;
  h: number; // font height
  hasEOL: boolean;
}

export interface ExtractedPage {
  page: number; // 1-based
  text: string;
  items: ExtractedItem[];
}

/** An annotation resolved to concrete highlight rectangles on a page. */
export interface PlacedAnnotation extends Annotation {
  rects: PdfRect[]; // empty = quote not found; margin-note-only
}
