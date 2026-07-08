"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, PageViewport } from "pdfjs-dist";

export default function PdfPageCanvas({
  doc,
  page,
  width,
  onViewport,
}: {
  doc: PDFDocumentProxy;
  page: number;
  width: number; // CSS px to render at
  onViewport: (vp: PageViewport) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = width / base.width;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = pdfPage.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      cleanup = () => task.cancel();
      try {
        await task.promise;
        if (!cancelled) onViewport(viewport);
      } catch {
        // render cancelled — fine
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [doc, page, width, onViewport]);

  return <canvas ref={canvasRef} data-testid="pdf-canvas" className="block rounded-lg shadow" />;
}
