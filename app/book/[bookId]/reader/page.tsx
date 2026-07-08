"use client";

import { use } from "react";
import dynamic from "next/dynamic";

// pdf.js touches browser APIs at module scope — load the reader client-only.
const PdfReader = dynamic(() => import("@/components/reader/PdfReader"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto mt-10 h-[70vh] w-full max-w-xl animate-pulse rounded-lg bg-stone-200" />
  ),
});

export default function ReaderPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = use(params);
  return <PdfReader bookId={bookId} />;
}
