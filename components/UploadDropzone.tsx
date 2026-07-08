"use client";

import { useRef, useState } from "react";

export default function UploadDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !disabled) onFile(file);
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition ${
        dragOver
          ? "border-amber-400 bg-amber-50"
          : "border-stone-300 bg-white text-stone-500"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="pdf-upload-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      📄 Tap to choose a PDF (or drag one here)
    </div>
  );
}
