"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Annotation, BookAnalysis, BookRecord } from "./types";

interface BookAnnotatorDB extends DBSchema {
  books: { key: string; value: BookRecord };
  /** Raw PDF bytes per bookId. */
  files: { key: string; value: { bookId: string; bytes: ArrayBuffer } };
  analysis: { key: string; value: { bookId: string; analysis: BookAnalysis } };
  /** key = `${bookId}:${page}` — annotations for one page (analyzed exactly once). */
  pageAnnotations: {
    key: string;
    value: { key: string; bookId: string; page: number; annotations: Annotation[] };
  };
}

let dbPromise: Promise<IDBPDatabase<BookAnnotatorDB>> | null = null;

function db() {
  dbPromise ??= openDB<BookAnnotatorDB>("book-annotator", 1, {
    upgrade(d) {
      d.createObjectStore("books", { keyPath: "bookId" });
      d.createObjectStore("files", { keyPath: "bookId" });
      d.createObjectStore("analysis", { keyPath: "bookId" });
      d.createObjectStore("pageAnnotations", { keyPath: "key" });
    },
  });
  return dbPromise;
}

export async function saveBook(record: BookRecord, pdfBytes: ArrayBuffer) {
  const d = await db();
  const tx = d.transaction(["books", "files"], "readwrite");
  await tx.objectStore("books").put(record);
  await tx.objectStore("files").put({ bookId: record.bookId, bytes: pdfBytes });
  await tx.done;
}

export async function getBook(bookId: string) {
  return (await db()).get("books", bookId);
}

export async function getPdfBytes(bookId: string): Promise<ArrayBuffer | undefined> {
  const row = await (await db()).get("files", bookId);
  return row?.bytes;
}

export async function saveAnalysis(bookId: string, analysis: BookAnalysis) {
  await (await db()).put("analysis", { bookId, analysis });
}

export async function getAnalysis(bookId: string): Promise<BookAnalysis | undefined> {
  const row = await (await db()).get("analysis", bookId);
  return row?.analysis;
}

export async function savePageAnnotations(
  bookId: string,
  page: number,
  annotations: Annotation[],
) {
  await (await db()).put("pageAnnotations", {
    key: `${bookId}:${page}`,
    bookId,
    page,
    annotations,
  });
}

export async function getPageAnnotations(
  bookId: string,
  page: number,
): Promise<Annotation[] | undefined> {
  const row = await (await db()).get("pageAnnotations", `${bookId}:${page}`);
  return row?.annotations;
}

export async function getAllAnnotations(bookId: string) {
  const d = await db();
  const rows = await d.getAll("pageAnnotations");
  return rows
    .filter((r) => r.bookId === bookId)
    .sort((a, b) => a.page - b.page);
}
