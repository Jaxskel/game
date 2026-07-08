"use client";

/**
 * Lazy, browser-only loader for pdf.js. pdfjs-dist touches DOM globals at
 * module scope, so it must never be evaluated during server prerender —
 * import it dynamically the first time a browser code path needs it.
 *
 * We use the `legacy` build: the modern build relies on brand-new JS APIs
 * (e.g. Map.getOrInsertComputed) missing from Safari and older Chrome.
 */
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs as typeof import("pdfjs-dist");
  });
  return pdfjsPromise;
}
