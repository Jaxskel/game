"use client";

import { useRef, useState } from "react";

/**
 * Photograph pages from a physical book. Users add photos in reading order,
 * then build them into an annotatable book.
 */
export default function SnapPages({
  onBuild,
  onVideo,
  disabled,
}: {
  onBuild: (files: File[]) => void;
  onVideo: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-stone-700">
        📷 Only have the paper book?{" "}
        <span className="font-normal text-stone-500">
          Photograph the pages you&apos;re studying (in order, good light, one
          page per photo) and I&apos;ll turn them into an annotatable book.
        </span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        data-testid="page-photos-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) setPhotos((prev) => [...prev, ...files]);
          e.target.value = "";
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 active:scale-95 transition disabled:opacity-50"
        >
          {photos.length === 0 ? "📷 Snap pages" : "＋ Add more pages"}
        </button>
        {photos.length > 0 && (
          <>
            <span className="text-xs text-stone-500" data-testid="photo-count">
              {photos.length} page{photos.length === 1 ? "" : "s"} ready
            </span>
            <button
              onClick={() => setPhotos([])}
              disabled={disabled}
              className="text-xs text-stone-400 underline underline-offset-2"
            >
              clear
            </button>
          </>
        )}
      </div>
      {photos.length > 0 && (
        <button
          onClick={() => onBuild(photos)}
          disabled={disabled}
          data-testid="build-from-photos"
          className="mt-3 w-full rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white shadow-lg shadow-amber-200 active:scale-95 transition disabled:opacity-50"
        >
          Build my book from {photos.length} photo{photos.length === 1 ? "" : "s"} →
        </button>
      )}

      <div className="mt-4 border-t border-stone-100 pt-3">
        <p className="text-sm text-stone-500">
          🎥 Or <span className="font-medium text-stone-700">record a
          page-flip video</span> — flip slowly, holding each page still for a
          moment, and I&apos;ll grab one clear shot of every page.
        </p>
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          data-testid="page-video-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onVideo(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => videoRef.current?.click()}
          disabled={disabled}
          data-testid="record-video"
          className="mt-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 active:scale-95 transition disabled:opacity-50"
        >
          🎥 Record / choose a page-flip video
        </button>
      </div>
    </div>
  );
}
