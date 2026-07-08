"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";
import { getPdfjs } from "@/lib/pdf/worker";
import { extractPage } from "@/lib/pdf/extract";
import { matchQuote } from "@/lib/pdf/match";
import { GUTTER_X } from "@/lib/pdf/textToPdf";
import { exportAnnotatedPdf, downloadBytes } from "@/lib/pdf/export";
import { ensureAnnotations, type AnnotateMeta } from "@/lib/annotate";
import { getAllAnnotations, getAnalysis, getBook, getPdfBytes } from "@/lib/db";
import type {
  Annotation,
  BookAnalysis,
  BookRecord,
  ExtractedPage,
  PlacedAnnotation,
} from "@/lib/types";
import PdfPageCanvas from "./PdfPageCanvas";
import HighlightLayer from "./HighlightLayer";
import MarginNotesLayer from "./MarginNotesLayer";
import ColorLegend from "./ColorLegend";
import PageNav from "./PageNav";
import ExportButton from "@/components/ExportButton";

const EXTERNAL_GUTTER = 184; // CSS px notes column for PDFs without a built-in gutter

export default function PdfReader({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<BookRecord | null | undefined>(undefined);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [viewport, setViewport] = useState<PageViewport | null>(null);
  const [annotations, setAnnotations] = useState<Map<number, Annotation[]>>(
    new Map(),
  );
  const [annotating, setAnnotating] = useState(false);
  const [minImportance, setMinImportance] = useState(1);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const extractCache = useRef(new Map<number, ExtractedPage>());

  const hasBuiltInGutter = book?.provider === "gutenberg";

  // ---- load book, analysis, pdf ----
  useEffect(() => {
    let cancelled = false;
    let openedDoc: PDFDocumentProxy | null = null;
    (async () => {
      const [record, a, fileBytes] = await Promise.all([
        getBook(bookId),
        getAnalysis(bookId),
        getPdfBytes(bookId),
      ]);
      if (cancelled) return;
      if (!record || !fileBytes) {
        setBook(null);
        return;
      }
      setBook(record);
      setAnalysis(a ?? null);
      setBytes(fileBytes);
      const pdfjs = await getPdfjs();
      openedDoc = await pdfjs.getDocument({ data: fileBytes.slice(0) }).promise;
      if (!cancelled) setDoc(openedDoc);
    })();
    return () => {
      cancelled = true;
      openedDoc?.loadingTask.destroy();
    };
  }, [bookId]);

  // ---- measure container ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [book]);

  const meta: AnnotateMeta | null = useMemo(() => {
    if (!book) return null;
    return {
      bookId,
      title: book.title,
      author: book.author,
      analysisContext: {
        characters: analysis?.characters.map((c) => c.name).slice(0, 30) ?? [],
        themes: analysis?.themes.map((t) => t.theme).slice(0, 15) ?? [],
      },
    };
  }, [book, analysis, bookId]);

  const getExtracted = useCallback(
    async (p: number): Promise<ExtractedPage> => {
      const cached = extractCache.current.get(p);
      if (cached) return cached;
      const d = doc;
      if (!d) throw new Error("document not loaded");
      const extracted = await extractPage(await d.getPage(p), p);
      extractCache.current.set(p, extracted);
      return extracted;
    },
    [doc],
  );

  const onPageAnnotations = useCallback((p: number, anns: Annotation[]) => {
    setAnnotations((prev) => {
      const next = new Map(prev);
      next.set(p, anns);
      return next;
    });
  }, []);

  // ---- lazy annotation of current page ± 2 ----
  useEffect(() => {
    if (!doc || !meta) return;
    let cancelled = false;
    (async () => {
      const wanted = [page, page + 1, page + 2, page - 1, page - 2].filter(
        (p) => p >= 1 && p <= doc.numPages,
      );
      const extracted = await Promise.all(wanted.map(getExtracted));
      if (cancelled) return;
      setAnnotating(true);
      await ensureAnnotations(meta, extracted, onPageAnnotations, (msg) =>
        setError(`Annotating hit a snag: ${msg}`),
      );
      if (!cancelled) setAnnotating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, meta, page, getExtracted, onPageAnnotations]);

  // ---- place current page's annotations ----
  const placed: PlacedAnnotation[] = useMemo(() => {
    const anns = annotations.get(page) ?? [];
    const extracted = extractCache.current.get(page);
    if (!extracted) return [];
    return anns
      .filter((a) => a.importance >= minImportance)
      .map((a) => ({ ...a, rects: matchQuote(extracted.items, a.exact_quote) }));
  }, [annotations, page, minImportance]);

  // ---- layout ----
  const externalGutter = hasBuiltInGutter ? 0 : EXTERNAL_GUTTER;
  const canvasW = Math.max(
    280,
    Math.min(containerW - externalGutter, 820),
  );
  const scale = viewport ? viewport.scale : 1;
  const gutterLeftCss = hasBuiltInGutter
    ? GUTTER_X * scale
    : canvasW + 8;
  const totalWidth = canvasW + externalGutter;

  // ---- export ----
  const annotateAll = useCallback(async () => {
    if (!doc || !meta) return;
    setBusyText("Annotating every page…");
    try {
      for (let p = 1; p <= doc.numPages; p += 5) {
        const batch: ExtractedPage[] = [];
        for (let q = p; q < Math.min(p + 5, doc.numPages + 1); q++) {
          batch.push(await getExtracted(q));
        }
        await ensureAnnotations(meta, batch, onPageAnnotations);
        setBusyText(
          `Annotating every page… ${Math.min(p + 4, doc.numPages)}/${doc.numPages}`,
        );
      }
    } finally {
      setBusyText(null);
    }
  }, [doc, meta, getExtracted, onPageAnnotations]);

  const exportPdf = useCallback(async () => {
    if (!doc || !book || !bytes) return;
    setBusyText("Building your annotated PDF…");
    try {
      const rows = await getAllAnnotations(bookId);
      const placedByPage = new Map<number, PlacedAnnotation[]>();
      for (const row of rows) {
        if (row.annotations.length === 0) continue;
        const extracted = await getExtracted(row.page);
        placedByPage.set(
          row.page,
          row.annotations.map((a) => ({
            ...a,
            rects: matchQuote(extracted.items, a.exact_quote),
          })),
        );
      }
      const out = await exportAnnotatedPdf({
        pdfBytes: bytes,
        title: book.title,
        author: book.author,
        analysis,
        placedByPage,
        hasBuiltInGutter,
      });
      downloadBytes(
        out,
        `${book.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-annotated.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "export failed");
    } finally {
      setBusyText(null);
    }
  }, [doc, book, bytes, bookId, analysis, hasBuiltInGutter, getExtracted]);

  // ---- render ----
  if (book === null) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-stone-600">This book isn&apos;t stored in this browser.</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-amber-600 underline">
          Start with a new book →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <Link
          href={`/book/${bookId}`}
          className="text-sm text-stone-500 underline underline-offset-4"
        >
          ← Analysis
        </Link>
        <PageNav
          page={page}
          numPages={doc?.numPages ?? book?.pageCount ?? 1}
          onGoto={(p) =>
            setPage(Math.max(1, Math.min(doc?.numPages ?? 1, p)))
          }
        />
        <label className="flex items-center gap-2 text-xs text-stone-600">
          Show
          <select
            value={minImportance}
            onChange={(e) => setMinImportance(Number(e.target.value))}
            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5"
          >
            <option value={1}>All notes</option>
            <option value={2}>Notable +</option>
            <option value={3}>Key only</option>
          </select>
        </label>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <ColorLegend />
        {annotating && (
          <span
            className="animate-pulse text-xs font-medium text-amber-700"
            data-testid="annotating-indicator"
          >
            ✏️ annotating…
          </span>
        )}
      </div>

      {hasBuiltInGutter && (
        <p className="mb-5 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900">
          Page numbers may differ from your printed copy — use the quoted words
          and chapter headings to find each passage, then copy the highlight in.
        </p>
      )}

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800">
          {error}
        </p>
      )}

      <div ref={containerRef} className="w-full">
        {doc ? (
          <div
            className="relative mx-auto"
            style={{ width: totalWidth }}
            data-testid="page-container"
          >
            <PdfPageCanvas
              doc={doc}
              page={page}
              width={canvasW}
              onViewport={setViewport}
            />
            {viewport && (
              <>
                <HighlightLayer placed={placed} viewport={viewport} />
                <MarginNotesLayer
                  placed={placed}
                  viewport={viewport}
                  gutterLeft={gutterLeftCss}
                  totalWidth={totalWidth}
                />
              </>
            )}
          </div>
        ) : (
          <div className="mx-auto h-[70vh] w-full max-w-xl animate-pulse rounded-lg bg-stone-200" />
        )}
      </div>

      <div className="mx-auto mt-8 max-w-md">
        <ExportButton
          onExport={exportPdf}
          onAnnotateAll={annotateAll}
          busyText={busyText}
        />
        <p className="mt-2 text-center text-xs text-stone-500">
          The download includes a study-guide cover page plus every highlight
          and margin note baked into the pages.
        </p>
      </div>
    </main>
  );
}
