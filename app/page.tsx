"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import BookConfirmCard from "@/components/BookConfirmCard";
import SourcePicker from "@/components/SourcePicker";
import { compressImage } from "@/lib/image";
import {
  IngestError,
  ingestPhotos,
  ingestSource,
  ingestUpload,
  ingestYouTube,
} from "@/lib/ingest";
import type { BookSourceCandidate, IdentifyResult } from "@/lib/types";

type Step = "capture" | "confirm" | "source";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("capture");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identify, setIdentify] = useState<IdentifyResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [sources, setSources] = useState<BookSourceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  const onImage = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    setPhotoUrl(URL.createObjectURL(file));
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch("/api/identify-book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not identify the book");
      setIdentify(data as IdentifyResult);
      setStep("confirm");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onConfirm = useCallback(async (t: string, a: string) => {
    setTitle(t);
    setAuthor(a);
    setStep("source");
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/search-book?title=${encodeURIComponent(t)}&author=${encodeURIComponent(a)}`,
      );
      const data = await res.json();
      setSources(res.ok ? (data.sources ?? []) : []);
    } catch {
      setSources([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const run = useCallback(
    async (fn: () => Promise<string>) => {
      setError(null);
      try {
        const bookId = await fn();
        setIngestStatus("Opening your book…");
        router.push(`/book/${bookId}`);
      } catch (e) {
        console.error("book ingest failed:", e);
        setIngestStatus(null);
        const detail =
          e instanceof Error && e.message ? ` (${e.message.slice(0, 200)})` : "";
        setError(
          e instanceof IngestError
            ? e.message
            : `Something went wrong getting the book${detail}. Try another source, or upload your own PDF.`,
        );
      }
    },
    [router],
  );

  const onPick = useCallback(
    (s: BookSourceCandidate) =>
      run(() =>
        ingestSource(s, title || s.title, author || s.author, (status, pct) =>
          setIngestStatus(pct != null ? `${status} ${pct}%` : status),
        ),
      ),
    [run, title, author],
  );

  const onUpload = useCallback(
    (file: File) => run(() => ingestUpload(file, title, author, setIngestStatus)),
    [run, title, author],
  );

  const onSnapPages = useCallback(
    (files: File[]) =>
      run(() => ingestPhotos(files, title, author, setIngestStatus)),
    [run, title, author],
  );

  const onSnapVideo = useCallback(
    (file: File) =>
      run(async () => {
        setIngestStatus("Opening your video…");
        const { extractPageFrames } = await import("@/lib/video");
        const frames = await extractPageFrames(file, setIngestStatus);
        return ingestPhotos(frames, title, author, setIngestStatus);
      }),
    [run, title, author],
  );

  const onYouTube = useCallback(
    (url: string) =>
      run(() => ingestYouTube(url, title, author, setIngestStatus)),
    [run, title, author],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 py-10">
      {step === "capture" && (
        <CameraCapture
          onImage={onImage}
          busy={busy}
          onSkip={() => {
            setIdentify(null);
            setPhotoUrl(null);
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <BookConfirmCard
          result={identify}
          photoUrl={photoUrl}
          onConfirm={onConfirm}
          onRetake={() => {
            setIdentify(null);
            setPhotoUrl(null);
            setStep("capture");
          }}
        />
      )}
      {step === "source" && (
        <SourcePicker
          sources={sources}
          loading={searching}
          status={ingestStatus}
          onPick={onPick}
          onUpload={onUpload}
          onSnapPages={onSnapPages}
          onSnapVideo={onSnapVideo}
          onYouTube={onYouTube}
          onBack={() => setStep("confirm")}
        />
      )}
      {error && (
        <div
          className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          data-testid="error-banner"
        >
          {error}
        </div>
      )}
    </main>
  );
}
